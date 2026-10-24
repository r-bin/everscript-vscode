// Ownership: the routines of `soe://rom/code/` by name: each code/script knowledge entry with its
// reconstructed C (code-c-index.ts) and where it sits in the ROM being read (code-locate.ts), and,
// per routine, the analysis the pages are built from: the whole listing with the centralized asm
// comments (asm-comments.json) infused, what it calls, and which WRAM it reads and writes.
// Pure apart from the files it reads once; cached per ROM buffer.
//
// The knowledge entry's address is the US address. Comments are keyed by it too, so a routine
// that moved (a PAL ROM, a rebuilt ROM) gets the comment of the same byte offset into the routine.

import { entries } from '../localizations/knowledge';
import type { KnowledgeEntry } from '../localizations/knowledge';
import { getRomComment } from '../localizations/comments';
import { getTable } from '../localizations/tables';
import { identifyEvermoreVariant } from '../variant-resolver';
import { OPCODES } from '../../../platform/snes/opcodes-65816';
import { routineLines } from './asm-view';
import type { AsmLine } from './asm-view';
import { cFunctionFor } from './code-c-index';
import type { CFunction } from './code-c-index';
import { locate } from './code-locate';
import type { Located } from './code-locate';

/** Where a routine is in this ROM: `unchecked` when there is no US ROM to compare with (the US address is assumed). */
type Where = Omit<Located, 'how'> & { how: Located['how'] | 'unchecked' };
/** One routine: its unique folder `name`, knowledge entry, US address, place in this ROM, C. */
interface CodeFunction { name: string; entry: KnowledgeEntry; vanilla: number; at: Where; c: CFunction | null }
type Access = 'read' | 'write' | 'modify';
/** One WRAM address a routine touches; `viaDb` when it is an absolute operand above $1FFF (WRAM only if DB is $7E). */
interface WramUse { addr: number; access: Set<Access>; viaDb: boolean }
/** A routine read from the ROM: its lines (comments infused), what it calls, the WRAM it uses, the record fields (`+$05,y`) and I/O registers. */
interface Analysis { lines: AsmLine[]; calls: number[]; wram: WramUse[]; fields: number[]; io: number[]; commented: number }
interface Catalog { rom: Uint8Array; ref: Uint8Array | null; list: CodeFunction[]; byName: Map<string, CodeFunction>; byAddr: Map<number, CodeFunction>; analyses: Map<string, Analysis> }

const READS = /^(LDA|LDX|LDY|CMP|CPX|CPY|BIT|ADC|SBC|AND|ORA|EOR|PEI)$/;
const WRITES = /^(STA|STX|STY|STZ)$/;
const MODIFIES = /^(INC|DEC|ASL|LSR|ROL|ROR|TSB|TRB)$/;
const DATA_MODES = new Set(['abs', 'absx', 'absy', 'long', 'longx']);

const isIo = (a: number): boolean => (a >= 0x2100 && a < 0x2200) || (a >= 0x4000 && a < 0x4400);
const operandOf = (l: AsmLine): number => l.bytes.slice(1).reduceRight((a, b) => a * 256 + b, 0);

/** Where a call or same-bank jump on `l` goes, or null. */
function callTarget(l: AsmLine): number | null {
    const o = OPCODES[l.op];
    if ((o.mnemonic === 'JSL' || o.mnemonic === 'JML') && o.mode === 'long') return operandOf(l);
    if ((o.mnemonic === 'JSR' || o.mnemonic === 'JMP') && o.mode === 'abs') return (l.addr & 0xFF0000) | operandOf(l);
    return null;
}

/** The US ROM to compare with: the configured vanilla ROM if it is the US release, else this ROM if it is. */
function referenceFor(rom: Uint8Array, vanilla: Uint8Array | null): Uint8Array | null {
    if (vanilla && identifyEvermoreVariant(vanilla) === 'us') return vanilla;
    return identifyEvermoreVariant(rom) === 'us' ? rom : null;
}

const cache = new WeakMap<Uint8Array, Catalog>();

/** Every routine with a knowledge entry (kind `code` or `script`), located in `rom`. */
function catalog(rom: Uint8Array, vanilla: Uint8Array | null = null): Catalog {
    const hit = cache.get(rom);
    const ref = referenceFor(rom, vanilla);
    if (hit && hit.ref === ref) return hit;
    const known = entries('rom').filter(e => e.kind === 'code' || e.kind === 'script');
    const count = new Map<string, number>();
    for (const e of known) count.set(e.name || '', (count.get(e.name || '') || 0) + 1);
    const list = known.map(e => {
        const base = e.name || 'routine';
        const name = (count.get(base) || 0) > 1 || !e.name ? `${base}_${e.addr.toString(16).toUpperCase()}` : base;
        const at: Where = ref ? locate(rom, ref, e.addr) : { addr: e.addr, how: 'unchecked' };
        return { name, entry: e, vanilla: e.addr, at, c: cFunctionFor(e.addr, e.name) };
    });
    if (ref && ref !== rom) settle(rom, ref, list);
    const made: Catalog = {
        rom, ref, list, analyses: new Map(),
        byName: new Map(list.map(f => [f.name, f])),
        byAddr: new Map(list.filter(f => f.at.addr !== null).map(f => [f.at.addr as number, f])),
    };
    cache.set(rom, made);
    return made;
}

/**
 * Second pass over a moved ROM: a routine not found near its US place is searched everywhere, and
 * one found in several places takes the place its nearest unambiguous neighbour's shift predicts.
 */
function settle(rom: Uint8Array, ref: Uint8Array, list: CodeFunction[]): void {
    for (const fn of list) if (fn.at.how === 'missing') fn.at = locate(rom, ref, fn.vanilla, true);
    const sure = list.filter(f => f.at.addr !== null && !f.at.ambiguous);
    for (const fn of list.filter(f => f.at.ambiguous && f.at.candidates)) {
        const bank = fn.vanilla & 0xFF0000;
        const near = sure.filter(f => (f.vanilla & 0xFF0000) === bank)
            .sort((a, b) => Math.abs(a.vanilla - fn.vanilla) - Math.abs(b.vanilla - fn.vanilla))[0];
        const want = near ? fn.vanilla + ((near.at.addr as number) - near.vanilla) : null;
        if (want !== null && (fn.at.candidates as number[]).includes(want)) fn.at = { addr: want, how: want === fn.vanilla ? 'same' : 'moved' };
    }
}

/** The routine `name` in `cat`, searching the whole ROM for it if the nearby search missed it. */
function findFunction(cat: Catalog, name: string): CodeFunction | null {
    const fn = cat.byName.get(name);
    if (!fn || fn.at.how !== 'missing' || !cat.ref) return fn || null;
    const at = locate(cat.rom, cat.ref, fn.vanilla, true);
    if (at.addr !== null) { fn.at = at; cat.byAddr.set(at.addr, fn); }
    return fn;
}

/** The name a call target goes by in this ROM: a routine's folder name, else (unmoved code only) a table's. */
function targetName(cat: Catalog, addr: number, unmoved: boolean): string | null {
    const fn = cat.byAddr.get(addr) || cat.byAddr.get(addr ^ 0x400000);
    if (fn) return fn.name;
    const t = unmoved ? getTable(addr) : null;
    return t ? t.name : null;
}

/** The routine read from this ROM (see Analysis). Null when it is not in this ROM. */
function analyse(cat: Catalog, fn: CodeFunction): Analysis | null {
    if (fn.at.addr === null) return null;
    const done = cat.analyses.get(fn.name);
    if (done) return done;
    const start = fn.at.addr, delta = start - fn.vanilla, unmoved = delta === 0;
    const end = fn.entry.end > fn.entry.addr ? fn.entry.end + delta : null;
    const lines = routineLines(cat.rom, start, { end, starts: new Set(cat.byAddr.keys()) });
    const calls: number[] = [], io: number[] = [], fields: number[] = [], wram = new Map<number, WramUse>();
    let commented = 0;
    for (const l of lines) {
        const c = getRomComment(l.addr - delta);
        if (c && (c.comment || c.label)) { commented++; if (c.comment) l.comment = c.comment; }
        const o = OPCODES[l.op], target = callTarget(l);
        if (target !== null) {
            calls.push(target);
            const n = targetName(cat, target, unmoved) || (c && c.label) || undefined;
            if (n) l.name = n; else delete l.name;
            continue;
        }
        if (!DATA_MODES.has(o.mode)) continue;
        const v = operandOf(l), long = o.mode === 'long' || o.mode === 'longx';
        const access: Access | null = READS.test(o.mnemonic) ? 'read' : WRITES.test(o.mnemonic) ? 'write' : MODIFIES.test(o.mnemonic) ? 'modify' : null;
        if (!access) continue;
        if (!long && isIo(v)) { if (!io.includes(v)) io.push(v); continue; }
        if ((o.mode === 'absx' || o.mode === 'absy') && v < 0x100) { if (!fields.includes(v)) fields.push(v); continue; }   // a record field off X/Y
        const addr = long ? v : 0x7E0000 | v;
        if (addr < 0x7E0000 || addr > 0x7FFFFF) continue;   // a long operand into ROM: a table, not WRAM
        const use = wram.get(addr) || { addr, access: new Set<Access>(), viaDb: !long && v >= 0x2000 };
        use.access.add(access);
        wram.set(addr, use);
    }
    const made = { lines, calls: [...new Set(calls)], wram: [...wram.values()].sort((a, b) => a.addr - b.addr), fields: fields.sort((a, b) => a - b), io: io.sort((a, b) => a - b), commented };
    cat.analyses.set(fn.name, made);
    return made;
}

/** Routines (in `cat`) that call `fn`, from their listings. */
function callers(cat: Catalog, fn: CodeFunction): CodeFunction[] {
    if (fn.at.addr === null) return [];
    const at = fn.at.addr;
    return cat.list.filter(other => other !== fn && (analyse(cat, other)?.calls || []).some(t => t === at || t === (at ^ 0x400000)));
}

export type { CodeFunction, Analysis, Catalog, WramUse, Where };
export { catalog, findFunction, analyse, callers };
