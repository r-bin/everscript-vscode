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
// 5. Fuzz: from every captured state, variants with random registers, flags and direct page (`--fuzz N`, 16 each)
//    reach the paths the reference never takes; both images must still agree where the ROM returns.
//   node tools/c-to-rom/g1.mts [--rom <clean rom>] [--samples 48] [--frames 8414] [--fuzz 16] [--fresh]
//                              [--trace name:index] [name ...]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { boot, coreId, stripHeader, hex, WRAM_SIZE, REFERENCE_FRAMES, type Core } from './emu.mts';
import { buildImage, bindings, sourceFiles, OUT, type Binding } from './build.mts';
import { disassemble, cdlFor } from './disasm.mts';

const require = createRequire(import.meta.url);
const { Cpu65816 } = require('../../dist/platform/snes/cpu65816');
const { SnesBus } = require('../../dist/platform/snes/snes-bus');

const STATE_D = 98;        // the save state's ICPU.Registers block starts at 92: PB DB P A D S X Y PC
const KEEP_FIRST = 8;
const CAPTURE_BATCH = 24;      // routines per capture run, leaving breakpoints for their pending returns

interface Regs { a: number; x: number; y: number; s: number; d: number; db: number; p: number; pb: number; pc: number }
interface Sample { frame: number; regs: Regs; wram: Uint8Array; after?: { regs: Regs; wram: Uint8Array } }
interface Run { regs: Regs; wram: Uint8Array; io: string[]; minS: number; error?: string; stackWrite?: boolean }

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

// ---------- fuzz ----------

/** Variants of a real entry state: random A, X, Y (8-bit index keeps a 0 high byte), N V Z C, and the 256 bytes
 * of the direct page. Deterministic (seeded by the sample's position). */
function fuzz(s: Sample, n: number, seed: number): Sample[] {
    let x = (seed * 2654435761 + 12345) >>> 0;
    const rnd = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x; };
    const out: Sample[] = [];
    for (let i = 0; i < n; i++) {
        const regs = { ...s.regs };
        const x8 = (regs.p & 0x10) !== 0;
        regs.a = rnd() & 0xFFFF;
        regs.x = rnd() & (x8 ? 0xFF : 0xFFFF);
        regs.y = rnd() & (x8 ? 0xFF : 0xFFFF);
        regs.p = (regs.p & ~0xC3) | (rnd() & 0xC3);
        const wram = new Uint8Array(s.wram);
        for (let k = 0; k < 0x100; k++) {
            const at = (regs.d + k) & 0xFFFF;
            if (at < 0x2000 && (at <= regs.s - 0x40 || at > regs.s)) wram[at] = rnd() & 0xFF;   // not the live stack
        }
        out.push({ frame: s.frame, regs, wram });
    }
    return out;
}

// ---------- run ----------

function run(image: Uint8Array, s: Sample, limit = 3_000_000, trace?: string[]): Run {
    const bus = new SnesBus(image);
    bus.wram.set(s.wram);
    const io: string[] = [];
    let stackWrite = false;
    const logged = {
        read: (a: number) => bus.read(a),
        write: (a: number, v: number) => {
            const bank = a >> 16, off = a & 0xFFFF;
            // a store (not a push: those write at S) into the stack below S, where the C keeps its frames
            const w = (bank & 0x40) === 0 || bank === 0x7E ? off : -1;
            if (w >= 0 && w < cpu.s && w > s.regs.s - 0x200) stackWrite = true;
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
            if (trace) {
                const [l] = disassemble(image, cpu.pb << 16 | cpu.pc, 1, (cpu.p & 0x20) !== 0, (cpu.p & 0x10) !== 0);
                trace.push(`${hex(cpu.pb << 16 | cpu.pc)} ${l.text.padEnd(18)} A=${hex(cpu.a, 4)} X=${hex(cpu.x, 4)} Y=${hex(cpu.y, 4)} S=${hex(cpu.s, 4)} D=${hex(cpu.d, 4)} P=${hex(cpu.p, 2)}`);
            }
            cpu.step();
            if (cpu.s < minS) minS = cpu.s;
            if (cpu.s > entryS) break;
        }
    } catch (e: any) {
        return { regs: snap(cpu), wram: bus.wram, io, minS, error: e.message, stackWrite };
    }
    return { regs: snap(cpu), wram: bus.wram, io, minS, stackWrite };
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

/** Copies of `image`, each with one operand bit of one of the routine's first instructions flipped. */
function mutations(image: Uint8Array, b: Binding, cdl: Uint8Array | null, max = 8): { image: Uint8Array; what: string }[] {
    const out: { image: Uint8Array; what: string }[] = [];
    for (const l of disassemble(image, b.addr, 64, false, false, cdl)) {
        if (/^(RTL|RTS|RTI)/.test(l.text) || out.length >= max) break;
        if (l.bytes.length < 2 || /^(B..|BRL|REP|SEP|JSL|JSR|JML|JMP|PEA)/.test(l.text)) continue;
        const m = new Uint8Array(image);
        m[(l.pc & 0x3FFFFF) + 1] ^= 0x01;
        out.push({ image: m, what: `${hex(l.pc)} ${l.text}, operand bit 0 flipped` });
    }
    return out;
}

// ---------- main ----------

if (import.meta.url === `file://${process.argv[1]}`) {
    const a = process.argv.slice(2), opt = (n: string) => { const i = a.indexOf('--' + n); return i < 0 ? null : a.splice(i, 2)[1]; };
    const fresh = a.includes('--fresh'), captureOnly = a.includes('--capture-only');
    const romPath: string = require('../rom').baseRomOrExit('evermore', opt('rom'));
    const samples = Number(opt('samples') || 48), frames = Number(opt('frames') || REFERENCE_FRAMES), fuzzN = Number(opt('fuzz') ?? 16);
    const traceArg = opt('trace');
    const names = a.filter(x => !x.startsWith('--'));
    const rom = stripHeader(new Uint8Array(readFileSync(romPath)));
    const list = bindings(sourceFiles()).filter(b => !names.length || names.includes(b.name));
    const toCapture = list.filter(b => fresh || !existsSync(cachePath(rom, b, samples, frames)));
    if (captureOnly) {
        // child: one batch (the core allows 64 exec breakpoints: the routines plus their pending returns)
        const got = await capture(rom, toCapture, samples, frames);
        for (const b of toCapture) saveSamples(cachePath(rom, b, samples, frames), got.get(b.addr)!);
        process.exit(0);
    }
    if (toCapture.length) {
        console.log(`capturing entry states of ${toCapture.length} routine(s) over ${frames} frames …`);
        const batches: Binding[][] = [];
        for (let i = 0; i < toCapture.length; i += CAPTURE_BATCH) batches.push(toCapture.slice(i, i + CAPTURE_BATCH));
        await Promise.all(batches.map(batch => new Promise<void>((resolve, reject) => {
            const args = [process.argv[1], '--capture-only', '--rom', romPath, '--samples', String(samples), '--frames', String(frames), ...(fresh ? ['--fresh'] : []), ...batch.map(b => b.name)];
            const p = spawn(process.execPath, args, { stdio: ['ignore', 'inherit', 'inherit'] });
            p.on('exit', code => (code === 0 ? resolve() : reject(new Error(`capture of ${batch.map(b => b.name).join(' ')}: exit ${code}`))));
        })));
    }
    const built = await buildImage(rom);
    const vanilla: Uint8Array = require('../table-hack/tables').build(rom, []).image;
    const cdl = cdlFor(rom);
    if (traceArg) {
        // --trace <name>:<state index>: both instruction traces of one entry state
        const [tn, ti] = traceArg.split(':');
        const b = list.find(x => x.name === tn)!;
        const st = loadSamples(cachePath(rom, b, samples, frames))[Number(ti || 0)];
        for (const [label, img] of [['ROM', vanilla], ['C', built.image]] as const) {
            const t: string[] = [];
            const res = run(img, st, 100_000, t);
            console.log(`--- ${label}: ${t.length} instructions${res.error ? ', ' + res.error : ''}`);
            console.log(t.slice(0, 400).join('\n'));
        }
        process.exit(0);
    }
    const lines = ['# G1: bound C routines against the ROM', '', `Reference: power-on, no input, ${frames} frames. ${samples} sampled entry states per routine.`, '',
        '| routine | states | interpreter = snes9x | C = ROM | fuzzed: C = ROM | mutation caught |', '|---|---|---|---|---|---|'];
    let failed = 0;
    for (const b of list) {
        const ss = loadSamples(cachePath(rom, b, samples, frames));
        let oracle = 0, oracleN = 0, ok = 0, firstFail = '', oracleFail = '';
        let mutCaught = false;
        const muts = mutations(vanilla, b, cdl);
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
            for (const mut of mutCaught ? [] : muts) {
                const m = run(mut.image, s);
                if (m.error || diff(v, m, s.regs.s, Math.min(v.minS, m.minS))) { mutCaught = true; break; }
            }
        }
        let fz = 0, fzN = 0, fuzzFail = '';
        ss.forEach((s0, i) => {
            for (const s of fuzz(s0, fuzzN, b.addr ^ i)) {
                const v = run(vanilla, s, 200_000);
                if (v.error || v.stackWrite) continue;     // no return from this state, or it stores into the stack
                fzN++;
                const c = run(built.image, s, 2_000_000);
                const d = c.error ? `C: ${c.error}` : diff(v, c, s.regs.s, Math.min(v.minS, c.minS));
                if (!d) fz++; else if (!fuzzFail) fuzzFail = `fuzzed from frame ${s.frame}, entry ${JSON.stringify(s.regs)}: ${d}`;
            }
        });
        const pass = ok === ss.length && ss.length > 0 && mutCaught && oracle === oracleN && fz === fzN;
        if (!pass) failed++;
        lines.push(`| \`${b.name}\` ${hex(b.addr)} | ${ss.length} | ${oracle}/${oracleN} | ${ok}/${ss.length} | ${fz}/${fzN} | ${muts.length ? (mutCaught ? 'yes' : '**no**') : 'no operand'} |`);
        if (firstFail) lines.push(`|  | C differs | ${firstFail.replace(/\|/g, '/')} | | | |`);
        if (fuzzFail) lines.push(`|  | fuzzed: C differs | ${fuzzFail.replace(/\|/g, '/')} | | | |`);
        if (oracleFail) lines.push(`|  | interpreter differs | ${oracleFail.replace(/\|/g, '/')} | | | |`);
    }
    lines.push('', failed ? `**${failed} routine(s) fail G1.**` : `All ${list.length} routine(s) pass G1.`);
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, 'G1.md'), lines.join('\n') + '\n');
    console.log(lines.join('\n'));
    process.exit(failed ? 1 : 0);
}
