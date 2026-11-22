// Proof of concept: one WRAM variable moved by name (docs/open-evermore/wram.md). Open Evermore names WRAM in its
// files (scripts, rings, formulas, weapons); for implode to place WRAM as it places ROM resources, every instruction
// that reaches a variable must be one implode can rewrite. This finds them for one knowledge entry and, when nothing
// blocks it, moves the variable and plays a stored playback on vanilla and on the moved build, comparing WRAM through
// the move (old place in vanilla = new place in the build).
//   node tools/open-evermore/wram-poc.mts <WRAM name> [--to <WRAM name | $7E:xxxx>] [--movie <file.evsmv>] [--frames n]
//   node tools/open-evermore/wram-poc.mts --scan      every WRAM entry the recorded play reached, ranked by blockers
// References come from the vanilla CDL library (cdl-recorder skill): xrefs.bin (each PC with the WRAM bytes it touched,
// how, and whether through a pointer), the capped PCs' bulk ranges, script-xrefs.bin (event scripts), plus a static scan
// of every recorded instruction head for an operand inside the variable (code a playback reached but did not record).
// An instruction is rewritable when its operand names the variable itself: absolute or long, plain or indexed, whose
// base lies inside it. Everything else blocks: direct page, indirect, a pointer, a base outside (an array that holds
// it), a loop over many addresses, DMA, a script. Moving an operand keeps the instruction, its length and its cycles
// (WRAM is one speed), so the build can stay in step.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { boot } from './play.mts';
import { wramAt, wramText } from './evermore/codecs/records.mts';

const require = createRequire(import.meta.url);
const { CdlLibrary } = require('../../dist/platform/cdl/library');
const { OPCODES, instructionLength } = require('../../dist/platform/snes/opcodes-65816');
const { parseMovie, groupEvents, WRAM_BASE, WRAM_SIZE } = require('../../dist/platform/tas/movie');
const { baseRomPath } = require('../../dist/games');
const KNOWLEDGE = require('../../dist/games/evermore/localizations/knowledge');

const LIBRARY = join(homedir(), 'Library/Application Support/Code/User/globalStorage/rbin.everscript/cdl-library');
const DEFAULT_MOVIE = join(new URL('.', import.meta.url).pathname, '../../.agents/skills/sample-playbacks/playbacks/intro-2m20.evsmv');
const CDL_CODE = 0x01, IDX8 = 0x10, ACC8 = 0x20, XR_POINTER = 0x10, XR_DMA = 0x20, XREFS_PER_PC = 128;
const DIRECT = new Set(['abs', 'absx', 'absy', 'long', 'longx']);

interface Site { pc: number; how: string; rewrite: boolean; why: string; maybe?: boolean }
interface Report { name: string; at: number; size: number; sites: Site[]; scripts: number; blockers: number; maybe: number }

const hex = (v: number, n = 6) => '$' + v.toString(16).toUpperCase().padStart(n, '0');
const bus = (pc: number) => hex(0xC00000 | pc);
/** The library keeps a PC as the bus address it ran at ($8F:A198); HiROM puts every form at offset & $3FFFFF. */
const offsetOf = (pcBus: number) => pcBus & 0x3FFFFF;

/** The library by WRAM address, and every recorded instruction head with a WRAM operand, once. */
interface Index { byAddr: Map<number, { pc: number; flags: number }[]>; byPc: Map<number, number[]>; bulk: { pc: number; lo: number; hi: number }[]; heads: Map<number, number[]>; scripts: Map<number, number> }
function index(rom: Uint8Array, lib: any): Index {
    const byAddr = new Map<number, { pc: number; flags: number }[]>(), byPc = new Map<number, number[]>(), bulk = [], heads = new Map<number, number[]>(), scripts = new Map<number, number>();
    for (const [key, flags] of lib.xrefs as Map<number, number>) {
        const spaceAddr = key % 0x4000000;
        if (spaceAddr >> 24 !== 0) continue;
        const a = spaceAddr & 0xFFFFFF, list = byAddr.get(a) ?? byAddr.set(a, []).get(a)!;
        const pc = offsetOf(Math.floor(key / 0x4000000));
        list.push({ pc, flags });
        (byPc.get(pc) ?? byPc.set(pc, []).get(pc)!).push(a);
    }
    for (const [key, s] of lib.stats as Map<number, { count: number; lo: number; hi: number }>) if (key >>> 24 === 0 && s.count >= XREFS_PER_PC) bulk.push({ pc: offsetOf(key & 0xFFFFFF), lo: s.lo, hi: s.hi });
    for (let pc = 0; pc < rom.length; pc++) {
        const d = decode(rom, lib.cdl, pc);
        if (!d || !DIRECT.has(d.mode)) continue;
        const w = wramOf(d.mode, d.operand);
        if (w !== null && (d.mode.startsWith('long') || w < 0x2000)) (heads.get(w) ?? heads.set(w, []).get(w)!).push(pc);
    }
    for (const key of (lib.scriptXrefs as Map<number, number>).keys()) { const a = key % 0x20000; scripts.set(a, (scripts.get(a) ?? 0) + 1); }
    return { byAddr, byPc, bulk, heads, scripts };
}

/** The instruction at ROM offset `pc`: its mode and operand (null when the CDL does not know it as code). */
function decode(rom: Uint8Array, cdl: Uint8Array, pc: number): { op: number; mode: string; operand: number; length: number; text: string } | null {
    if (!(cdl[pc] & CDL_CODE)) return null;
    const op = rom[pc], { mnemonic, mode } = OPCODES[op], length = instructionLength(op, !!(cdl[pc] & ACC8), !!(cdl[pc] & IDX8));
    let operand = 0;
    for (let k = length - 1; k >= 1; k--) operand = operand * 256 + rom[pc + k];
    return { op, mode, operand, length, text: `${mnemonic.toLowerCase()} ${mode} ${hex(operand, 2 * (length - 1))}` };
}

/** The WRAM offset an operand names, if it is a WRAM address in any form: long $7E/$7F, or 16-bit below $2000 (low
 *  RAM, mirrored in every bank) or with DB = $7E (taken on trust for operands the play reached there). */
function wramOf(mode: string, operand: number): number | null {
    if (mode === 'long' || mode === 'longx') { const b = operand >> 16; return b === 0x7E || b === 0x7F ? operand - 0x7E0000 : (b < 0x40 || (b >= 0x80 && b < 0xC0)) && (operand & 0xFFFF) < 0x2000 ? operand & 0xFFFF : null; }
    return mode === 'abs' || mode === 'absx' || mode === 'absy' ? operand : null;
}

function study(rom: Uint8Array, lib: any, ix: Index, name: string, at: number, size: number): Report {
    const end = at + size, sites = new Map<number, Site>();
    const add = (s: Site) => { const old = sites.get(s.pc); if (!old || (old.rewrite && !s.rewrite)) sites.set(s.pc, s); };
    // Every PC the play saw touch the variable.
    for (let a = at; a < end; a++) for (const { pc, flags } of ix.byAddr.get(a) ?? []) {
        const d = decode(rom, lib.cdl, pc);
        if (!d) { add({ pc, how: 'not code in the CDL', rewrite: false, why: 'unknown instruction' }); continue; }
        if (flags & XR_DMA) { add({ pc, how: d.text, rewrite: false, why: 'a DMA' }); continue; }
        if (flags & XR_POINTER || !DIRECT.has(d.mode)) { add({ pc, how: d.text, rewrite: false, why: flags & XR_POINTER ? 'through a pointer' : `${d.mode} addressing` }); continue; }
        const base = wramOf(d.mode, d.operand);
        if (base === null || base < at || base >= end) { add({ pc, how: d.text, rewrite: false, why: `its base ${base === null ? 'is no WRAM' : wramText(base)} lies outside (an array or block that holds it)` }); continue; }
        // A width-2 access at the last byte, or an index that also reaches past it: the base serves more than it.
        const past = (ix.byPc.get(pc) ?? []).filter(x => x < at || x >= end);
        if (past.length) { add({ pc, how: d.text, rewrite: false, why: `the same instruction also reaches ${wramText(Math.min(...past))}${past.length > 1 ? ` (+${past.length - 1})` : ''}` }); continue; }
        add({ pc, how: d.text, rewrite: true, why: 'operand inside' });
    }
    // Recorded instruction heads whose operand lies inside, though the play never reached the variable through them.
    for (let a = at; a < end; a++) for (const pc of ix.heads.get(a) ?? []) if (!sites.has(pc)) add({ pc, how: decode(rom, lib.cdl, pc)!.text, rewrite: false, maybe: true, why: 'operand inside, never seen touching it: WRAM only if its DB mirrors low RAM' });
    // PCs capped at 128 addresses: their range (lowest to highest address) covers it, which does not say they touch it.
    for (const b of ix.bulk) if (b.hi >= at && b.lo < end && !sites.has(b.pc)) add({ pc: b.pc, how: decode(rom, lib.cdl, b.pc)?.text ?? '?', rewrite: false, maybe: true, why: `capped: touched ${hex(0x7E0000 + b.lo)}-${hex(0x7E0000 + b.hi)} somewhere` });
    let scripts = 0;
    for (let a = at; a < end; a++) scripts += ix.scripts.get(a) ?? 0;
    const list = [...sites.values()].sort((x, y) => x.pc - y.pc);
    return { name, at, size, sites: list, scripts, blockers: list.filter(s => !s.rewrite && !s.maybe).length + scripts, maybe: list.filter(s => s.maybe).length };
}

/** The build: every rewritable operand moved by `delta`. */
function moved(rom: Uint8Array, lib: any, r: Report, delta: number): Uint8Array {
    const out = rom.slice();
    for (const s of r.sites.filter(x => x.rewrite)) {
        const d = decode(rom, lib.cdl, s.pc)!, n = d.length - 1, v = d.operand + delta;
        for (let k = 0; k < n; k++) out[s.pc + 1 + k] = (v >> (8 * k)) & 0xFF;
    }
    return out;
}

async function play(a: Uint8Array, b: Uint8Array, from: number, to: number, size: number, moviePath: string, frames: number): Promise<string> {
    const machines = await Promise.all([boot(), boot()]);
    machines.forEach((c, i) => {
        const rom = i === 0 ? a : b, p = c.Module._my_malloc(rom.length);
        c.HEAPU8.set(rom, p);
        c.Module._startWithRom(p, rom.length, 32000);
    });
    const [A, B] = machines.map(c => c.Module);
    const movie = parseMovie(readFileSync(moviePath, 'utf8'), basename(moviePath)), events = groupEvents(movie.events);
    const n = Math.min(frames, movie.count);
    // Vanilla's bytes at `from` are the build's at `to`; vanilla's at `to` (never used) are the build's at `from`.
    const map = (i: number) => i >= from && i < from + size ? i - from + to : i >= to && i < to + size ? i - to + from : i;
    for (let k = 0; k < n; k++) {
        for (const ev of events.get(k) || []) for (const M of [A, B]) {
            if (ev.kind === 'W') for (let i = 0; i < ev.bytes.length; i++) M.writeMemory(ev.addr + i, ev.bytes[i]);
            else if (ev.kind === 'R') M._softReset();
        }
        for (const M of [A, B]) { M._setJoypadInput(movie.pads[k]); M._mainLoop(); }
        const wa = A.readMemoryRange(WRAM_BASE, WRAM_SIZE), wb = B.readMemoryRange(WRAM_BASE, WRAM_SIZE);
        for (let i = 0; i < WRAM_SIZE; i++) if (wa[i] !== wb[map(i)]) return `frame ${k}: vanilla ${hex(0x7E0000 + i)} = $${wa[i].toString(16)}, the build's ${hex(0x7E0000 + map(i))} = $${wb[map(i)].toString(16)}`;
        if (A.getCPUState().pc !== B.getCPUState().pc) return `frame ${k}: PC ${A.getCPUState().pc.toString(16)} / ${B.getCPUState().pc.toString(16)}`;
    }
    return `in step for ${n} frames (WRAM compared through the move and PC, every frame)`;
}

async function main(): Promise<void> {
    const args = process.argv.slice(2), opt = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
    const rom = new Uint8Array(readFileSync(baseRomPath('evermore')));
    const lib = new CdlLibrary(LIBRARY, Buffer.from(rom));
    if (!lib.xrefs.size) throw new Error(`no CDL library for this ROM under ${LIBRARY}`);
    const entries: { name: string; addr: number; end: number }[] = KNOWLEDGE.entries('wram').filter((e: { name: string | null; addr: number }) => e.name && e.addr >> 16 === 0x7E);
    const ix = index(rom, lib);
    if (args[0] === '--scan') {
        const rows = entries.map(e => study(rom, lib, ix, e.name, e.addr & 0xFFFF, e.end - e.addr + 1)).filter(r => r.sites.some(s => s.why === 'operand inside'));
        rows.sort((x, y) => x.blockers - y.blockers || y.sites.length - x.sites.length);
        console.log(`${rows.length} WRAM entries reached in recorded play; ${rows.filter(r => !r.blockers).length} have no blocker:`);
        for (const r of rows.slice(0, 40)) console.log(`  ${r.blockers.toString().padStart(3)} blockers  ${r.sites.filter(x => x.rewrite).length.toString().padStart(3)} to move  ${r.maybe.toString().padStart(3)} capped  ${r.name} (${hex(0x7E0000 + r.at)}, ${r.size} B)`);
        return;
    }
    const at = wramAt(args[0]), e = entries.find(x => x.name === args[0]);
    if (at === null || !e) throw new Error(`"${args[0]}" is no WRAM knowledge entry`);
    const r = study(rom, lib, ix, e.name, at, e.end - e.addr + 1);
    console.log(`${r.name} (${hex(0x7E0000 + r.at)}, ${r.size} B): ${r.sites.filter(x => x.rewrite).length} to move, ${r.blockers} blockers${r.scripts ? ` (${r.scripts} script accesses)` : ''}, ${r.maybe} unknown (capped PCs whose range covers it, and operands inside never seen touching it: not moved, the playback decides)`);
    for (const s of r.sites.filter(x => !x.maybe)) console.log(`  ${s.rewrite ? 'move ' : 'BLOCK'} ${bus(s.pc)}  ${s.how.padEnd(22)} ${s.why}`);
    const target = opt('--to');
    if (!target) return;
    const to = wramAt(target);
    if (to === null) throw new Error(`--to "${target}": a WRAM name or $7E:xxxx`);
    if (r.blockers) { console.log('Not moved: something above reaches it in a way implode cannot rewrite.'); return; }
    const build = moved(rom, lib, r, to - r.at);
    console.log(`Moved to ${hex(0x7E0000 + to)} (${wramText(to)}); playing ${basename(opt('--movie') ?? DEFAULT_MOVIE)} on vanilla and on the build…`);
    console.log(await play(rom, build, r.at, to, r.size, opt('--movie') ?? DEFAULT_MOVIE, Number(opt('--frames') ?? 1e9)));
    process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
