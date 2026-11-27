// The WRAM reader census (docs/open-evermore/wram.md §2): for each vanilla WRAM variable, every instruction that reaches
// it and whether implode can rewrite it. A variable whose every reader is an operand that names it (absolute or long,
// plain or indexed, base inside it, touching nothing outside) can move: implode writes those operands from its new place.
// Everything else pins it to its vanilla address, with the first reason.
//   node tools/open-evermore/wram-census.mts            write evermore/map/<release>.wram-readers.json from the CDL library
//   node tools/open-evermore/wram-census.mts --check    print what would change, write nothing
//   node tools/open-evermore/wram-census.mts --part <p> one part of the WRAM map (wram/<p>.json): each vanilla variable,
//                                                       movable (its group), pinned (why) or never reached
// Sources: the vanilla CDL library (cdl-recorder skill): xrefs.bin (each PC with every WRAM byte it touched, read/write,
// byte/word, through a pointer, by DMA), pcstats.bin (PCs capped at 128 addresses keep only a lowest-highest range),
// script-xrefs.bin (event scripts). A word access is keyed by its first byte: it touches the next one too, which the
// proof of concept missed (W3: a word read at $0103 reaches JOYPAD1_HELD's low byte).
// The file holds ROM addresses and offsets only (facts about the game, no bytes of it), so it is checked in beside the
// mapping file and implode needs no CDL library.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { OPCODES, instructionLength } = require('../../dist/platform/snes/opcodes-65816');

export const LIBRARY = join(homedir(), 'Library/Application Support/Code/User/globalStorage/rbin.everscript/cdl-library');
const CDL_CODE = 0x01, IDX8 = 0x10, ACC8 = 0x20;
const XR_WORD = 0x08, XR_POINTER = 0x10, XR_DMA = 0x20, XREFS_PER_PC = 128;
/** The widest reach (bytes from its base) by which one instruction makes its variables one group. */
const JOIN_SPAN = 0x400;
export const DIRECT = new Set(['abs', 'absx', 'absy', 'long', 'longx']);

export interface Site { pc: number; how: string; rewrite: boolean; why: string; maybe?: boolean; length?: number; offset?: number; width?: number; bank?: number }
export interface Report { name: string; at: number; size: number; sites: Site[]; scripts: number; blockers: number; maybe: number }

export const hex = (v: number, n = 6) => '$' + v.toString(16).toUpperCase().padStart(n, '0');
/** "$80:8123" from a bus address. */
export const busText = (v: number) => '$' + (v >> 16).toString(16).toUpperCase().padStart(2, '0') + ':' + (v & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
/** The library keeps a PC as the bus address it ran at ($8F:A198); HiROM puts every form at offset & $3FFFFF. */
const offsetOf = (pcBus: number) => pcBus & 0x3FFFFF;

/** The library by WRAM byte (a word access counts at both bytes), and every recorded instruction head with a WRAM operand. */
export interface Index { byAddr: Map<number, { pc: number; flags: number }[]>; byPc: Map<number, number[]>; bulk: { pc: number; lo: number; hi: number }[]; heads: Map<number, number[]>; scripts: Map<number, number> }
export function index(rom: Uint8Array, lib: any): Index {
    const byAddr = new Map<number, { pc: number; flags: number }[]>(), byPc = new Map<number, number[]>(), bulk: Index['bulk'] = [], heads = new Map<number, number[]>(), scripts = new Map<number, number>();
    for (const [key, flags] of lib.xrefs as Map<number, number>) {
        const spaceAddr = key % 0x4000000;
        if (spaceAddr >> 24 !== 0) continue;
        const a = spaceAddr & 0xFFFFFF, pc = offsetOf(Math.floor(key / 0x4000000));
        for (const b of flags & XR_WORD ? [a, a + 1] : [a]) {
            (byAddr.get(b) ?? byAddr.set(b, []).get(b)!).push({ pc, flags });
            (byPc.get(pc) ?? byPc.set(pc, []).get(pc)!).push(b);
        }
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
export function decode(rom: Uint8Array, cdl: Uint8Array, pc: number): { op: number; mode: string; operand: number; length: number; text: string } | null {
    if (!(cdl[pc] & CDL_CODE)) return null;
    const op = rom[pc], { mnemonic, mode } = OPCODES[op], length = instructionLength(op, !!(cdl[pc] & ACC8), !!(cdl[pc] & IDX8));
    let operand = 0;
    for (let k = length - 1; k >= 1; k--) operand = operand * 256 + rom[pc + k];
    return { op, mode, operand, length, text: `${mnemonic.toLowerCase()} ${mode} ${hex(operand, 2 * (length - 1))}` };
}

/** The WRAM offset ($0000-$1FFFF) an operand names: long $7E/$7F, long into a low mirror, or 16-bit (low RAM in every
 *  code bank, or anything with DB = $7E: taken on trust for operands the play reached there). */
export function wramOf(mode: string, operand: number): number | null {
    if (mode === 'long' || mode === 'longx') { const b = operand >> 16; return b === 0x7E || b === 0x7F ? operand - 0x7E0000 : (b < 0x40 || (b >= 0x80 && b < 0xC0)) && (operand & 0xFFFF) < 0x2000 ? operand & 0xFFFF : null; }
    return mode === 'abs' || mode === 'absx' || mode === 'absy' ? operand : null;
}

/** The WRAM offset an instruction's operand names, in the bank of the bytes it touched: a 16-bit operand with DB = $7F
 *  names bank $7F. Null when the operand is no WRAM base of what it touched (a hardware register such as MDMAEN $420B,
 *  whose DMA the recorder credits to the store that starts it). */
export function baseOf(mode: string, operand: number, touched: number[]): number | null {
    const w = wramOf(mode, operand);
    if (w === null || !touched.length) return w;
    const lo = Math.min(...touched);
    const b = mode.startsWith('long') ? w : (lo & 0x10000) | (w & 0xFFFF);
    if (!mode.startsWith('long') && ((w & 0xFFFF) >= 0x2100 && (w & 0xFFFF) < 0x2200 || (w & 0xFFFF) >= 0x4200 && (w & 0xFFFF) < 0x4400)) return null;
    return b <= lo && lo - b < 0x10000 ? b : null;
}

/** Every reader of WRAM bytes `at`..`at + size - 1` (offsets in WRAM), each rewritable or a blocker. */
export function study(rom: Uint8Array, lib: any, ix: Index, name: string, at: number, size: number): Report {
    const end = at + size, sites = new Map<number, Site>();
    const add = (s: Site) => { const old = sites.get(s.pc); if (!old || (old.rewrite && !s.rewrite)) sites.set(s.pc, s); };
    for (let a = at; a < end; a++) for (const { pc, flags } of ix.byAddr.get(a) ?? []) {
        const d = decode(rom, lib.cdl, pc);
        if (!d) { add({ pc, how: 'not code in the CDL', rewrite: false, why: 'unknown instruction' }); continue; }
        if (flags & XR_DMA) { add({ pc, how: d.text, rewrite: false, why: 'a DMA' }); continue; }
        if (flags & XR_POINTER || !DIRECT.has(d.mode)) { add({ pc, how: d.text, rewrite: false, why: flags & XR_POINTER ? 'through a pointer' : `${d.mode} addressing` }); continue; }
        const base = baseOf(d.mode, d.operand, ix.byPc.get(pc) ?? [a]);
        if (base === null || base < at || base >= end) { add({ pc, how: d.text, rewrite: false, why: `its base ${base === null ? 'is no WRAM' : hex(0x7E0000 + base)} lies outside (an array or block that holds it)` }); continue; }
        const past = (ix.byPc.get(pc) ?? []).filter(x => x < at || x >= end);
        if (past.length) { add({ pc, how: d.text, rewrite: false, why: `the same instruction also reaches ${hex(0x7E0000 + Math.min(...past))}${past.length > 1 ? ` (+${past.length - 1})` : ''}` }); continue; }
        // A 16-bit operand of a variable past the low mirror needs DB = $7E; one below $2000 reaches it from any code bank.
        const width = Math.max(...(ix.byPc.get(pc) ?? [a])) - base + 1;
        add({ pc, how: d.text, rewrite: true, why: 'operand inside', length: d.length - 1, offset: base - at, width, bank: d.length === 4 ? d.operand >> 16 : undefined });
    }
    for (let a = at; a < end; a++) for (const pc of ix.heads.get(a) ?? []) if (!sites.has(pc)) add({ pc, how: decode(rom, lib.cdl, pc)!.text, rewrite: false, maybe: true, why: 'operand inside, never seen touching it: WRAM only if its DB mirrors low RAM' });
    for (const b of ix.bulk) if (b.hi >= at && b.lo < end && !sites.has(b.pc)) add({ pc: b.pc, how: decode(rom, lib.cdl, b.pc)?.text ?? '?', rewrite: false, maybe: true, why: `capped: touched ${hex(0x7E0000 + b.lo)}-${hex(0x7E0000 + b.hi)} somewhere` });
    let scripts = 0;
    for (let a = at; a < end; a++) scripts += ix.scripts.get(a) ?? 0;
    const list = [...sites.values()].sort((x, y) => x.pc - y.pc);
    return { name, at, size, sites: list, scripts, blockers: list.filter(s => !s.rewrite && !s.maybe).length + scripts, maybe: list.filter(s => s.maybe).length };
}

/** The checked-in census (evermore/map/<release>.wram-readers.json), keyed by a variable's vanilla place. */
export interface Census {
    format: 'open-evermore/wram-readers'; version: 1; release: string; source: string;
    /** "$7E:0133+4" (a group: every variable one instruction reaches together, moved rigidly) → the operands that reach
     *  it: [instruction, operand bytes (2 or 3), operand − group start, bytes it reaches from there (index included),
     *  a long operand's bank byte ($00/$80 for the low mirror, $7E, $7F)]. */
    movable: Record<string, (string | number)[][]>;
    /** "$7E:0104+2" → why it stays (the first blocker). A variable in neither list was never reached in the recording. */
    pinned: Record<string, string>;
    /** Block routines capped at 128 addresses: [instruction, first, last WRAM address]; a moved variable must stay inside the same ones. */
    capped: [string, string, string][];
    /** WRAM bytes the recording touched that no named variable holds: [first, last]. Nothing may be placed on them. */
    unnamed: [string, string][];
}
export const placeKey = (at: number, size: number) => `${busText(at)}+${size}`;
export const censusPath = (release: string) => join(dirname(new URL(import.meta.url).pathname), 'evermore', 'map', `${release}.wram-readers.json`);

async function main(): Promise<void> {
    const check = process.argv.includes('--check'), partArg = process.argv.indexOf('--part');
    const map = await import('./evermore/map.mts');
    map.selectRelease('us');
    const { vanillaWram } = await import('./evermore/codecs/wram.mts');
    if (partArg > 0) {
        const name = process.argv[partArg + 1], parts = map.memory('wram').flatMap(r => r.parts.map((p, k) => ({ ...p, to: r.parts[k + 1]?.from ?? r.to })));
        const p = parts.find(x => x.name === name);
        if (!p) throw new Error(`no part "${name}": ${parts.map(x => x.name).join(', ')}`);
        const c = JSON.parse(readFileSync(censusPath('us'), 'utf8')) as Census, place = (k: string) => { const [a, n] = k.split('+'); const f = parseInt(a.replace(/[$:]/g, ''), 16); return [f, f + Number(n)]; };
        const state = (at: number) => {
            for (const k of Object.keys(c.movable)) { const [f, t] = place(k); if (at >= f && at < t) return `movable, group ${k} (${c.movable[k].length} operands)`; }
            for (const [k, why] of Object.entries(c.pinned)) { const [f, t] = place(k); if (at >= f && at < t) return `PINNED: ${why}`; }
            return 'never reached';
        };
        console.log(`${p.name}: ${p.what}`);
        for (const v of vanillaWram()) if (!v.in && v.at >= p.from && v.at < p.to) console.log(`  ${busText(v.at)} ${String(v.size ?? '-').padStart(4)} ${(v.type ?? '').padEnd(16)} ${v.name.padEnd(40)} ${state(v.at)}`);
        return;
    }
    const { CdlLibrary } = require('../../dist/platform/cdl/library');
    const { baseRomPath } = require('../../dist/games');
    const rom = new Uint8Array(readFileSync(baseRomPath('evermore')));
    const lib = new CdlLibrary(LIBRARY, Buffer.from(rom));
    if (!lib.xrefs.size) throw new Error(`no CDL library for this ROM under ${LIBRARY}`);
    const ix = index(rom, lib);
    const census: Census = { format: 'open-evermore/wram-readers', version: 1, release: 'us', source: `the vanilla CDL library (${lib.xrefs.size} xrefs), ${new Date().toISOString().slice(0, 10)}`, movable: {}, pinned: {}, capped: [], unnamed: [] };
    const bus = (o: number) => busText(0x7E0000 + o);
    // Groups: the variables one instruction reaches together (an array read through its first cell's name, a word that
    // spans two variables) move as one, rigidly: every byte from the lowest to the highest any of them holds.
    const tops = vanillaWram().filter(v => !v.in && v.size && v.at >> 16 <= 0x7F).map(v => ({ ...v, from: v.at - 0x7E0000, to: v.at - 0x7E0000 + v.size! }));
    const owner = new Int32Array(0x20000).fill(-1);
    tops.forEach((v, k) => { for (let a = v.from; a < v.to; a++) owner[a] = k; });
    const parent = tops.map((_, k) => k), find = (k: number): number => parent[k] === k ? k : (parent[k] = find(parent[k]));
    const join = (a: number, b: number) => { const x = find(a), y = find(b); if (x !== y) parent[Math.max(x, y)] = Math.min(x, y); };
    // Only instructions implode could rewrite join: an operand that names WRAM (a pointer, DMA or capped block routine
    // pins whatever it reaches anyway, and would join half of WRAM).
    const capped = new Set(ix.bulk.map(b => b.pc)), indirect = new Set<number>();
    for (const list of ix.byAddr.values()) for (const { pc, flags } of list) if (flags & (XR_POINTER | XR_DMA)) indirect.add(pc);
    for (const [pc, addrs] of ix.byPc) {
        if (capped.has(pc) || indirect.has(pc)) continue;
        const d = decode(rom, lib.cdl, pc), base = d && DIRECT.has(d.mode) ? baseOf(d.mode, d.operand, addrs) : null;
        // A wide indexed reach (a whole-WRAM copy) joins nothing: it stays a blocker of what it touches.
        // A base below $0100 with an index is a field offset on a pointer in X or Y (`lda $0002,y`): no group either.
        if (base === null || base < 0x100 || base >= 0x20000 || Math.max(...addrs) - base >= JOIN_SPAN) continue;
        const touched = [base, ...addrs];
        const ks = [...new Set(touched.map(a => owner[a]).filter(k => k >= 0))];
        if (ks.length > 1 && ks.length < 64) { const lo = Math.min(...ks), hi = Math.max(...ks); for (let k = lo + 1; k <= hi; k++) join(lo, k); }
    }
    const groups = new Map<number, { from: number; to: number; names: string[] }>();
    tops.forEach((v, k) => { const g = groups.get(find(k)) ?? groups.set(find(k), { from: v.from, to: v.to, names: [] }).get(find(k))!; g.from = Math.min(g.from, v.from); g.to = Math.max(g.to, v.to); g.names.push(v.name); });
    let reached = 0;
    for (const g of groups.values()) {
        const r = study(rom, lib, ix, g.names[0], g.from, g.to - g.from);
        // Event scripts are no blocker: their WRAM operands are save- and temp-area cells by name (operands.mts), which
        // follow the wram kind; one written as a number pins its variable at implode (wram-script-number). What the
        // engine touches while a script instruction runs (script-xrefs.bin) is code, in xrefs.bin already.
        const key = placeKey(0x7E0000 + g.from, g.to - g.from), seen = r.sites.filter(s => !s.maybe);
        if (!seen.length) continue;
        reached++;
        if (g.from < 0x100) { census.pinned[key] = 'direct page (operands are offsets from D)'; continue; }
        const block = r.sites.find(s => !s.rewrite && !s.maybe);
        if (block) { census.pinned[key] = `${busText(0xC00000 | block.pc)} ${block.how}: ${block.why}`; continue; }
        census.movable[key] = r.sites.filter(s => s.rewrite).map(s => [busText(0xC00000 | s.pc), s.length!, s.offset!, s.width!, ...(s.bank !== undefined ? [s.bank] : [])]);
    }
    census.capped = ix.bulk.sort((a, b) => a.pc - b.pc).map(b => [busText(0xC00000 | b.pc), bus(b.lo), bus(b.hi)]);
    for (let a = 0; a < 0x20000; a++) {
        if (owner[a] >= 0 || !ix.byAddr.has(a)) continue;
        const last = census.unnamed.at(-1);
        if (last && parseInt(last[1].replace(/[$:]/g, ''), 16) - 0x7E0000 === a - 1) last[1] = bus(a); else census.unnamed.push([bus(a), bus(a)]);
    }
    const text = JSON.stringify(census, null, 1).replace(/\[\n((?:\s+(?:\d+|"[^"\n]+"),?\n)+)\s+\]/g, (_, body: string) => '[' + body.trim().split(/,?\n\s+/).join(', ') + ']') + '\n';
    console.log(`${reached} variables reached: ${Object.keys(census.movable).length} movable (${Object.values(census.movable).reduce((s, l) => s + l.length, 0)} operands), ${Object.keys(census.pinned).length} pinned; ${census.capped.length} capped routines; ${census.unnamed.length} unnamed touched ranges`);
    if (!check) { writeFileSync(censusPath('us'), text); console.log(`wrote ${censusPath('us')}`); }
}

if (process.argv[1] === new URL(import.meta.url).pathname) main().catch(e => { console.error(e.stack ?? e.message); process.exit(1); });
