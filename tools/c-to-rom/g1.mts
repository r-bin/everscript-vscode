// Gate G1 for every bound routine: the C, run from real entry states, leaves exactly the state the ROM's own bytes
// leave (docs/reverse-engineering/c-to-rom.md §4, §10).
//
// 1. Capture: the 2:20 reference (power-on, no input) runs in snes9x with an exec breakpoint on each bound routine;
//    a fixed sample of entries (the first ones and a deterministic spread over the run) is kept: registers (D from
//    the save state) and all 128 KB of WRAM. Where no NMI comes between entry and return, snes9x's own state after
//    the return is kept too (the oracle). Cached in out/c-to-rom/states/ (derived from the ROM: never committed).
// 2. Run each entry state on src/platform/snes/cpu65816.ts twice, vanilla image and C image, until the routine
//    returns (S rises above its entry value).
// 3. Compare A X Y S D DB P PB PC, all WRAM except the dead stack (bytes below the entry S that either run pushed),
//    and the I/O writes in order. The oracle check compares the vanilla run with snes9x the same way.
// 4. Mutation: flip one operand bit of the vanilla routine's first instruction that has an operand; the comparison
//    must notice on some state, or the states do not exercise the routine.
//   node tools/c-to-rom/g1.mts [--rom <clean rom>] [--samples 48] [--frames 8414] [--fresh] [name ...]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { boot, coreId, stripHeader, hex, WRAM_SIZE, REFERENCE_FRAMES, type Core } from './emu.mts';
import { buildImage, OUT, type Binding } from './build.mts';
import { disassemble } from './disasm.mts';

const require = createRequire(import.meta.url);
const { Cpu65816 } = require('../../dist/platform/snes/cpu65816');
const { SnesBus } = require('../../dist/platform/snes/snes-bus');

const STATE_D = 98;        // the save state's ICPU.Registers block starts at 92: PB DB P A D S X Y PC
const KEEP_FIRST = 8;

interface Regs { a: number; x: number; y: number; s: number; d: number; db: number; p: number; pb: number; pc: number }
interface Sample { frame: number; regs: Regs; wram: Uint8Array; after?: { regs: Regs; wram: Uint8Array } }
interface Run { regs: Regs; wram: Uint8Array; io: string[]; minS: number; error?: string }

// ---------- capture ----------

function cpuRegs(c: Core, d: number): Regs {
    const r = c.cpu();
    return { a: r.a, x: r.x, y: r.y, s: r.sp, d, db: r.db, p: r.p, pb: r.pb, pc: r.pc & 0xFFFF };
}

function stateD(c: Core): number {
    const M = c.M, p = M._saveState(), heap = (globalThis as any).HEAPU8 as Uint8Array;
    const d = heap[p + STATE_D] | heap[p + STATE_D + 1] << 8;
    if (typeof M._free === 'function') M._free(p);
    return d;
}

/** Deterministic spread: keep the first KEEP_FIRST hits, then every k-th hit with k doubling as the list fills. */
async function capture(rom: Uint8Array, list: Binding[], samples: number, frames: number): Promise<Map<number, Sample[]>> {
    const c = await boot(rom);
    const M = c.M;
    const out = new Map<number, Sample[]>(list.map(b => [b.addr, []]));
    const hits = new Map<number, number>(list.map(b => [b.addr, 0]));
    const stride = new Map<number, number>(list.map(b => [b.addr, 1]));
    const pending = new Map<number, { sample: Sample; s: number; nmi: number; target: number }>();   // return pc -> watch
    let frame = 0;
    for (const b of list) M.addExecBreakpoint(b.addr);
    M.onBreakpointHit = (e: { address: number }) => {
        const w = pending.get(e.address);
        if (w) {
            const r = c.cpu();
            if (r.sp === w.s) {
                pending.delete(e.address);
                if (!list.some(b => b.addr === e.address)) M.removeExecBreakpoint(e.address);
                const wram = c.wram();
                // an NMI between entry and return changes the frame counter: then snes9x is no oracle
                if ((wram[0x100] | wram[0x101] << 8) === w.nmi) w.sample.after = { regs: cpuRegs(c, stateD(c)), wram };
            }
        }
        const b = list.find(x => x.addr === e.address);
        if (!b) return false;
        const n = hits.get(b.addr)! + 1;
        hits.set(b.addr, n);
        const keep = out.get(b.addr)!;
        let k = stride.get(b.addr)!;
        if (keep.length >= samples) {            // full: thin out to every other one, double the stride
            const thin = keep.filter((_, i) => i < KEEP_FIRST || (i - KEEP_FIRST) % 2 === 0);
            keep.length = 0; keep.push(...thin);
            k *= 2; stride.set(b.addr, k);
        }
        if (n > KEEP_FIRST && (n - KEEP_FIRST) % k !== 0) return false;
        const regs = cpuRegs(c, stateD(c));
        const wram = c.wram();
        const sample: Sample = { frame, regs, wram };
        keep.push(sample);
        // the return address on the stack: RTL pops 3 bytes, RTS 2 (same bank)
        const st = (o: number) => wram[(regs.s + o) & 0xFFFF];
        const ret = b.ret === 'RTL'
            ? (st(3) << 16 | ((st(2) << 8 | st(1)) + 1) & 0xFFFF)
            : (regs.pb << 16 | ((st(2) << 8 | st(1)) + 1) & 0xFFFF);
        if (!pending.has(ret)) {
            pending.set(ret, { sample, s: regs.s + (b.ret === 'RTL' ? 3 : 2), nmi: wram[0x100] | wram[0x101] << 8, target: b.addr });
            M.addExecBreakpoint(ret);
        }
        return false;
    };
    for (; frame < frames; frame++) c.frame(0);
    M.onBreakpointHit = null;
    return out;
}

function cachePath(rom: Uint8Array, b: Binding, samples: number, frames: number): string {
    const key = createHash('sha256').update(rom).update(coreId()).update(`${b.addr} ${b.ret} ${samples} ${frames}`).digest('hex').slice(0, 16);
    return join(OUT, 'states', `${b.addr.toString(16)}-${key}.bin`);
}

function saveSamples(file: string, list: Sample[]): void {
    const meta = list.map(s => ({ frame: s.frame, regs: s.regs, after: s.after ? s.after.regs : null }));
    const head = Buffer.from(JSON.stringify(meta));
    const parts: Uint8Array[] = [Buffer.from(Uint32Array.of(head.length).buffer), head];
    for (const s of list) { parts.push(s.wram); if (s.after) parts.push(s.after.wram); }
    mkdirSync(join(OUT, 'states'), { recursive: true });
    writeFileSync(file, Buffer.concat(parts));
}

function loadSamples(file: string): Sample[] {
    const buf = readFileSync(file);
    const n = buf.readUInt32LE(0), meta = JSON.parse(buf.subarray(4, 4 + n).toString());
    let at = 4 + n;
    const take = () => { const w = new Uint8Array(buf.subarray(at, at + WRAM_SIZE)); at += WRAM_SIZE; return w; };
    return meta.map((m: any) => {
        const s: Sample = { frame: m.frame, regs: m.regs, wram: take() };
        if (m.after) s.after = { regs: m.after, wram: take() };
        return s;
    });
}

// ---------- run ----------

function run(image: Uint8Array, s: Sample, limit = 3_000_000): Run {
    const bus = new SnesBus(image);
    bus.wram.set(s.wram);
    const io: string[] = [];
    const logged = {
        read: (a: number) => bus.read(a),
        write: (a: number, v: number) => {
            const bank = a >> 16, off = a & 0xFFFF;
            if ((bank & 0x40) === 0 && off >= 0x2000 && off < 0x8000) io.push(`${hex(a)}=${v.toString(16)}`);
            bus.write(a, v);
        },
    };
    const cpu = new Cpu65816(logged);
    Object.assign(cpu, { a: s.regs.a, x: s.regs.x, y: s.regs.y, s: s.regs.s, d: s.regs.d, db: s.regs.db, pb: s.regs.pb, pc: s.regs.pc, p: s.regs.p });
    const entryS = s.regs.s;
    let minS = entryS;
    try {
        for (let n = 0; ; n++) {
            if (n > limit) throw new Error(`no return after ${limit} instructions`);
            cpu.step();
            if (cpu.s < minS) minS = cpu.s;
            if (cpu.s > entryS) break;
        }
    } catch (e: any) {
        return { regs: snap(cpu), wram: bus.wram, io, minS, error: e.message };
    }
    return { regs: snap(cpu), wram: bus.wram, io, minS };
}

const snap = (c: any): Regs => ({ a: c.a, x: c.x, y: c.y, s: c.s, d: c.d, db: c.db, p: c.p, pb: c.pb, pc: c.pc });

/** The first difference between two end states, or null. Dead stack: bank-0 bytes in (min S, entry S]. */
function diff(x: { regs: Regs; wram: Uint8Array; io?: string[] }, y: { regs: Regs; wram: Uint8Array; io?: string[] }, entryS: number, minS: number): string | null {
    for (const k of ['pc', 'pb', 's', 'a', 'x', 'y', 'p', 'd', 'db'] as const)
        if (x.regs[k] !== y.regs[k]) return `${k.toUpperCase()} ${hex(x.regs[k], 4)} vs ${hex(y.regs[k], 4)}`;
    const bytes: string[] = [];
    for (let i = 0; i < WRAM_SIZE; i++) {
        if (x.wram[i] === y.wram[i] || (i > minS && i <= entryS)) continue;
        bytes.push(`${hex(0x7E0000 + i)} ${x.wram[i].toString(16)} vs ${y.wram[i].toString(16)}`);
        if (bytes.length >= 4) break;
    }
    if (bytes.length) return 'WRAM ' + bytes.join(', ');
    if (x.io && y.io && x.io.join() !== y.io.join()) return `I/O writes ${x.io.slice(0, 6).join(' ')} vs ${y.io.slice(0, 6).join(' ')}`;
    return null;
}

/** A copy of `image` with one operand bit of the routine's first instruction with an operand flipped. */
function mutate(image: Uint8Array, b: Binding): { image: Uint8Array; what: string } | null {
    for (const l of disassemble(image, b.addr, 64, (b as any).m8, (b as any).x8)) {
        if (/^(RTL|RTS|RTI)/.test(l.text)) break;
        if (l.bytes.length < 2 || /^(B..|BRL|REP|SEP|JSL|JSR|JML|JMP)/.test(l.text)) continue;
        const m = new Uint8Array(image);
        m[(l.pc & 0x3FFFFF) + 1] ^= 0x01;
        return { image: m, what: `${hex(l.pc)} ${l.text}, operand bit 0 flipped` };
    }
    return null;
}

// ---------- main ----------

if (import.meta.url === `file://${process.argv[1]}`) {
    const a = process.argv.slice(2), opt = (n: string) => { const i = a.indexOf('--' + n); return i < 0 ? null : a.splice(i, 2)[1]; };
    const fresh = a.includes('--fresh');
    const romPath: string = require('../rom').baseRomOrExit('evermore', opt('rom'));
    const samples = Number(opt('samples') || 48), frames = Number(opt('frames') || REFERENCE_FRAMES);
    const names = a.filter(x => !x.startsWith('--'));
    const rom = stripHeader(new Uint8Array(readFileSync(romPath)));
    const built = await buildImage(rom);
    const vanilla: Uint8Array = require('../table-hack/tables').build(rom, []).image;
    const list = built.bindings.filter(b => !names.length || names.includes(b.name));
    const toCapture = list.filter(b => fresh || !existsSync(cachePath(rom, b, samples, frames)));
    if (toCapture.length) {
        console.log(`capturing entry states of ${toCapture.length} routine(s) over ${frames} frames …`);
        const got = await capture(rom, toCapture, samples, frames);
        for (const b of toCapture) saveSamples(cachePath(rom, b, samples, frames), got.get(b.addr)!);
    }
    const lines = ['# G1: bound C routines against the ROM', '', `Reference: power-on, no input, ${frames} frames. ${samples} sampled entry states per routine.`, '',
        '| routine | states | interpreter = snes9x | C = ROM | mutation caught |', '|---|---|---|---|---|'];
    let failed = 0;
    for (const b of list) {
        const ss = loadSamples(cachePath(rom, b, samples, frames));
        let oracle = 0, oracleN = 0, ok = 0, firstFail = '', oracleFail = '';
        let mutCaught = false;
        const mut = mutate(vanilla, b);
        for (const s of ss) {
            const v = run(vanilla, s), c = run(built.image, s);
            const minS = Math.min(v.minS, c.minS);
            if (s.after) {
                oracleN++;
                const d = v.error || diff(v, s.after, s.regs.s, Math.min(v.minS, s.regs.s - 0x200));
                if (!d) oracle++; else if (!oracleFail) oracleFail = `frame ${s.frame}: ${d}`;
            }
            const d = v.error ? `vanilla: ${v.error}` : c.error ? `C: ${c.error}` : diff(v, c, s.regs.s, minS);
            if (!d) ok++; else if (!firstFail) firstFail = `frame ${s.frame}, entry ${JSON.stringify(s.regs)}: ${d}`;
            if (mut && !mutCaught) {
                const m = run(mut.image, s);
                if (m.error || diff(v, m, s.regs.s, Math.min(v.minS, m.minS))) mutCaught = true;
            }
        }
        const pass = ok === ss.length && ss.length > 0 && mutCaught && oracle === oracleN;
        if (!pass) failed++;
        lines.push(`| \`${b.name}\` ${hex(b.addr)} | ${ss.length} | ${oracle}/${oracleN} | ${ok}/${ss.length} | ${mut ? (mutCaught ? 'yes' : '**no**') : 'no operand'} |`);
        if (firstFail) lines.push(`|  | C differs | ${firstFail.replace(/\|/g, '/')} | | |`);
        if (oracleFail) lines.push(`|  | interpreter differs | ${oracleFail.replace(/\|/g, '/')} | | |`);
    }
    lines.push('', failed ? `**${failed} routine(s) fail G1.**` : `All ${list.length} routine(s) pass G1.`);
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, 'G1.md'), lines.join('\n') + '\n');
    console.log(lines.join('\n'));
    process.exit(failed ? 1 : 0);
}
