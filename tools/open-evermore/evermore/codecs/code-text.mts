// The code kind's text (docs/open-evermore/code.md §5 C0): the routines the census finds, and each one written as Asar
// source in the export's syntax (platform/cdl/disasm.ts formatInstruction), labelled with everything explode knows:
// routine names from the knowledge base (the names of soe://rom/code/), a label at every jump and branch target, and
// the resource of another kind a long operand points into.
//
// Labels hold the FastROM address the CPU runs the code at: all recorded code is in the upper halves of banks
// $00 and $0C-$11, run as $80:xxxx and $8C-$91:xxxx, so a label is $800000 + its file offset. A label no file defines
// is named by its address (`loc_8C8123`, `func_8C8123`), so its value can be read from its name.
import { createRequire } from 'node:module';
import type { Span } from '../../codec.mts';
import { readCensus } from '../../code-census.mts';

const require = createRequire(import.meta.url);
const { OPCODES, instructionLength } = require('../../../../dist/platform/snes/opcodes-65816');
const { formatInstruction, relativeTarget } = require('../../../../dist/platform/cdl/disasm');
const KNOWLEDGE = require('../../../../dist/games/evermore/localizations/knowledge');

export const RUN = 0x800000;
const BANK = 0x10000;
export const hex6 = (v: number) => v.toString(16).toUpperCase().padStart(6, '0');
/** The file offset a bus address reads (HiROM, first 4 MiB), or -1 for WRAM, I/O and the system area. */
export function romOffset(bus: number): number {
    const bank = bus >>> 16;
    if (bank === 0x7E || bank === 0x7F) return -1;
    if (!(bank & 0x40) && (bus & 0xFFFF) < 0x8000) return -1;
    return bus & 0x3FFFFF;
}
/** The value of a label named by its address (`loc_8C8123`), or undefined. */
export function addressLabel(name: string): number | undefined {
    const m = /^(?:loc|func)_([0-9A-F]{6})$/.exec(name);
    return m ? parseInt(m[1], 16) : undefined;
}

export interface Routine { name: string; start: number; end: number; title?: string }
/** A byte range another kind owns (its pool or its generated tables). */
export interface Foreign extends Span { kind: string }

/** Length of the instruction at `off` with census width `w` (0-3). */
export const lengthAt = (rom: Uint8Array, off: number, w: number) => instructionLength(rom[off], (w & 1) === 1, (w & 2) === 2);

/** Every head the census gives, walked run by run (a run's instructions follow each other). */
export function censusHeads(rom: Uint8Array, release = 'us'): Map<number, number> {
    const c = readCensus(release);
    if (!c) throw new Error(`code: no census for release "${release}" (node tools/open-evermore/code-census.mts)`);
    const out = new Map<number, number>();
    for (const [at, w] of c.runs) {
        let off = parseInt(at.slice(1), 16);
        for (const d of w) { out.set(off, +d); off += lengthAt(rom, off, +d); }
    }
    return out;
}

/**
 * The routines: one per recorded call target and per knowledge code entry on an instruction head, then one more at
 * every head none of them reaches. A routine runs from its start to the end of its last instruction before the next
 * start (data between its instructions included); what follows that, up to the next start, stays in `_base/`.
 */
export function findRoutines(rom: Uint8Array, hd: Map<number, number>, foreign: (off: number) => boolean, release = 'us'): Routine[] {
    const c = readCensus(release)!;
    const named = new Map<number, { name: string; title?: string }>();
    const code = (KNOWLEDGE.entries('rom') as { kind: string; name: string; addr: number; title?: string }[]).filter(e => e.kind === 'code' || e.kind === 'script');
    const count = new Map<string, number>();
    for (const e of code) count.set(e.name, (count.get(e.name) ?? 0) + 1);
    for (const e of code) {
        if (e.kind !== 'code' || release !== 'us') continue;
        const off = romOffset(e.addr);
        if (off < 0 || !hd.has(off) || foreign(off)) continue;
        // The names of soe://rom/code/ (resources/code-catalog.ts): a name two entries share takes the address.
        named.set(off, { name: (count.get(e.name) ?? 0) > 1 ? `${e.name}_${e.addr.toString(16).toUpperCase()}` : e.name, title: e.title });
    }
    const starts = new Set<number>([...named.keys()]);
    for (const at of c.entries) { const off = parseInt(at.slice(1), 16); if (hd.has(off) && !foreign(off)) starts.add(off); }
    const sorted = [...hd.keys()].sort((a, b) => a - b);
    const extents = (): Map<number, number> => {
        const list = [...starts].sort((a, b) => a - b), out = new Map<number, number>();
        list.forEach((s, i) => {
            const limit = Math.min(list[i + 1] ?? Infinity, (s & ~(BANK - 1)) + BANK);
            let p = s, last = s;
            while (p < limit) {
                const w = hd.get(p);
                if (w === undefined) { p++; continue; }
                const len = lengthAt(rom, p, w);
                if (p + len > limit) break;
                p += len; last = p;
            }
            out.set(s, last);
        });
        return out;
    };
    // Heads no routine reaches start routines of their own, until every head is in one.
    for (;;) {
        const ext = extents(), list = [...ext].sort((a, b) => a[0] - b[0]);
        let k = 0, added = false;
        for (const h of sorted) {
            while (k < list.length && list[k][1] <= h) k++;
            const inside = k < list.length && list[k][0] <= h && h < list[k][1];
            if (!inside && !foreign(h)) { starts.add(h); added = true; while (k < list.length && list[k][0] <= h) k++; }
        }
        if (!added) return [...ext].sort((a, b) => a[0] - b[0]).map(([s, e]) => ({
            start: s, end: e, name: named.get(s)?.name ?? (c.entries.includes('$' + hex6(s)) ? 'func_' : 'loc_') + hex6(RUN + s), title: named.get(s)?.title,
        }));
    }
}

/** Decodes [start, end) as instruction and data pieces: a census head starts an instruction that fits, the rest is data. */
export function pieces(rom: Uint8Array, hd: Map<number, number>, start: number, end: number): { at: number; len: number; ins: boolean }[] {
    const out: { at: number; len: number; ins: boolean }[] = [];
    for (let p = start; p < end;) {
        const w = hd.get(p);
        const len = w === undefined ? 0 : lengthAt(rom, p, w);
        if (len && p + len <= end) { out.push({ at: p, len, ins: true }); p += len; continue; }
        let q = p + 1;
        while (q < end && !hd.has(q)) q++;
        out.push({ at: p, len: q - p, ins: false });
        p = q;
    }
    return out;
}

/** The instruction at `off` with census width `w`, as disasm.ts decodes it. */
export function decode(rom: Uint8Array, off: number, w: number) {
    const op = rom[off], len = lengthAt(rom, off, w);
    let operand = 0;
    for (let i = len - 1; i >= 1; i--) operand = operand * 256 + rom[off + i];
    return { op, mnemonic: OPCODES[op].mnemonic as string, mode: OPCODES[op].mode as string, len, operand, conflict: false };
}

/** Jump, branch and long targets of every routine's instructions, as file offsets. */
export function targets(rom: Uint8Array, hd: Map<number, number>, routines: Routine[]): Set<number> {
    const out = new Set<number>();
    for (const r of routines) for (const p of pieces(rom, hd, r.start, r.end)) {
        if (!p.ins) continue;
        const ins = decode(rom, p.at, hd.get(p.at)!), run = RUN + p.at;
        let t = -1;
        if (ins.mode === 'rel8' || ins.mode === 'rel16') t = romOffset(relativeTarget(ins, run));
        else if (ins.mode === 'abs' && (ins.mnemonic === 'JSR' || ins.mnemonic === 'JMP')) t = romOffset((run & 0xFF0000) | ins.operand);
        else if (ins.mode === 'long' || ins.mode === 'longx') t = romOffset(ins.operand);
        if (t >= 0) out.add(t);
    }
    return out;
}

export interface TextContext {
    rom: Uint8Array; hd: Map<number, number>;
    /** Label at a file offset (a routine's name, or a target's address name), if one is written there. */
    labelAt: Map<number, string>;
    /** The other kind's byte ranges, sorted. */
    foreign: Foreign[];
    /** The resource of another kind at a file offset (`maps/pyramid_outside+$12`), for comments. */
    resourceAt(off: number): string | null;
}

const foreignAt = (list: Foreign[], off: number): Foreign | null => {
    let lo = 0, hi = list.length - 1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (list[mid].end <= off) lo = mid + 1; else if (list[mid].start > off) hi = mid - 1; else return list[mid]; }
    return null;
};
export { foreignAt };

const dbLines = (rom: Uint8Array, at: number, len: number): string[] => {
    const out: string[] = [];
    for (let i = 0; i < len; i += 16) out.push('    db ' + Array.from(rom.subarray(at + i, at + Math.min(len, i + 16)), b => '$' + b.toString(16).toUpperCase().padStart(2, '0')).join(','));
    return out;
};

/** One routine as Asar source. */
export function routineText(t: TextContext, r: Routine): string {
    const { rom, hd } = t;
    const lines = [`; ${r.title ?? r.name}`, `; $${hex6(RUN + r.start).replace(/^(..)/, '$1:')}-$${hex6(RUN + r.end - 1).replace(/^(..)/, '$1:')} (${r.end - r.start} bytes); the code kind keeps it at its vanilla address (docs/open-evermore/code.md)`, `${r.name}:`];
    const resolve = (bus: number, width: 16 | 24 | 'rel'): string | null => {
        const off = romOffset(bus), name = off >= 0 ? t.labelAt.get(off) : undefined;
        if (!name) return null;
        if (width !== 24) return name;
        const delta = bus - (RUN + off);
        return delta ? `${name}${delta < 0 ? '-' : '+'}$${hex6(Math.abs(delta))}` : name;
    };
    for (const p of pieces(rom, hd, r.start, r.end)) {
        // Bytes another kind owns: kept out of this routine (`skip`), named by their kind.
        const f = foreignAt(t.foreign, p.at);
        let at = p.at, left = p.len;
        if (p.ins && f) {
            const ins = decode(rom, p.at, hd.get(p.at)!), text = formatInstruction(ins, RUN + p.at, () => null) ?? ins.mnemonic.toLowerCase();
            lines.push(`    skip ${p.len}`.padEnd(36) + `; ${t.labelAt.get(p.at) ? t.labelAt.get(p.at) + ': ' : ''}${f.kind} writes this instruction (vanilla: ${text})`);
            continue;
        }
        if (p.at !== r.start && t.labelAt.has(p.at)) lines.push(`${t.labelAt.get(p.at)}:`);
        if (p.ins) {
            const ins = decode(rom, p.at, hd.get(p.at)!), run = RUN + p.at;
            const asm = formatInstruction(ins, run, resolve);
            const notes: string[] = [];
            const owner = [...Array(ins.len - 1).keys()].map(i => foreignAt(t.foreign, p.at + 1 + i)).find(Boolean);
            if (owner) notes.push(`operand written by ${owner.kind}`);
            if (ins.mode === 'long' || ins.mode === 'longx') { const o = romOffset(ins.operand), res = o >= 0 && !t.labelAt.has(o) ? t.resourceAt(o) : null; if (res) notes.push('→ ' + res); }
            if (!asm) notes.push(`${ins.mnemonic.toLowerCase()} to $${hex6(relativeTarget(ins, run))}, a place no label marks`);
            const text = '    ' + (asm ?? dbLines(rom, p.at, p.len)[0].trim());
            lines.push(notes.length ? text.padEnd(36) + '; ' + notes.join('; ') : text);
            continue;
        }
        // Data: split where another kind's bytes or a label begin.
        while (left > 0) {
            const fo = foreignAt(t.foreign, at);
            if (fo) {
                const n = Math.min(left, fo.end - at);
                lines.push(`    skip ${n}`.padEnd(36) + `; ${fo.kind} owns these bytes`);
                at += n; left -= n; continue;
            }
            let n = 1;
            while (n < left && !foreignAt(t.foreign, at + n) && !t.labelAt.has(at + n)) n++;
            lines.push(...dbLines(rom, at, n));
            at += n; left -= n;
            if (left > 0 && t.labelAt.has(at) && !foreignAt(t.foreign, at)) lines.push(`${t.labelAt.get(at)}:`);
        }
    }
    return lines.join('\n') + '\n';
}
