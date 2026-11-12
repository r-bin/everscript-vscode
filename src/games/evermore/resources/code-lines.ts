// Ownership: `soe://rom/code/<name>/lines.json`: a routine's instructions as data, for readers that want
// names instead of numbers (the Code tab): each line raw (`text`) and named (`named`: a call by its
// routine, an operand by the WRAM address, table or routine it means), and, when this ROM has a CDL
// library, what the line did while recorded: how often it ran, the A/X widths, DB / D, and every
// address it touched (a pointer's targets too), named. Pure over the catalog and the injected library.
//
// An operand is named only where its address is known: direct page with the recorded D (D = 0 when
// none was recorded, as the engine runs), absolute below $2000 (low WRAM in every bank) or with a
// recorded DB, long always. A byte inside a typed record is named by its field path (types.json:
// `ENTITY_DYNAMIC_POOL[2].pos_y`, `DIRECT_PAGE_BLOCK.sprite_descriptor_ptr+2`); an untyped record names
// it as RECORD+$off only when smaller than a page. Hardware registers go by their names (`INIDISP`).

import { OPCODES } from '../../../platform/snes/opcodes-65816';
import { hiromFileOffset } from '../../../platform/snes/hirom';
import type { CdlView } from '../../../platform/cdl/library-read';
import { ioRegisterName } from '../../../platform/snes/io-registers';
import { getTable } from '../localizations/tables';
import { getWramField } from '../localizations/wram-map';
import { analyse, targetName } from './code-catalog';
import type { Catalog, CodeFunction } from './code-catalog';
import { ramSymbols } from './ram-symbols';
import { hex6 } from './code-search';
import { entries } from '../localizations/knowledge';
import type { KnowledgeEntry } from '../localizations/knowledge';

/** A named address: `name` as the listing shows it, `title` to explain it. */
interface Named { addr: string; name: string; title?: string }
interface Touch { name: string; addr: string; count: number; access: string; title?: string }
interface LineCdl { hits: number; m8: boolean; x8: boolean; db: string[]; d: string[]; touched: Touch[]; more: number }
interface Line { addr: string; bytes: string; text: string; named: string; comment?: string; call?: string; operand?: Named; cdl?: LineCdl }

const WRAM = 0x7E0000;
const PAGE = 0x100;
const SPACE = { WRAM: 0, ROM: 1, BUS: 2, IO: 3 };
const XR = { READ: 1, WRITE: 2, POINTER: 0x10 };
const CDL_CODE = 0x01, CDL_IDX8 = 0x10, CDL_ACC8 = 0x20;
const EXT_HEAD = 0x04;   // rom.ext: an instruction starts here
const DP_MODES = new Set(['dp', 'dpx', 'dpy', 'idp', 'idpx', 'idpy', 'ildp', 'ildpy', 'pei']);
const ABS_DATA = new Set(['abs', 'absx', 'absy']);
const NO_DATA = /^(JSR|JMP|JSL|JML|PEA|PER|MVN|MVP)$/;
const TOUCHED_MAX = 8;
/** The interrupt vectors (ROM offset): an interrupt's vector fetch is recorded on the instruction it interrupted. */
const VECTORS = 0xFFE0;

const h = (v: number, d: number): string => '$' + (v >>> 0).toString(16).toUpperCase().padStart(d, '0');
const plus = (name: string, off: number): string => (off ? name + '+' + h(off, off > 0xFF ? 4 : 2) : name);

/** The smallest RAM knowledge entry covering bus address `bus`. */
function smallestEntry(bus: number): KnowledgeEntry | null {
    let best: KnowledgeEntry | null = null;
    for (const e of entries('ram')) if (bus >= e.addr && bus <= e.end && (!best || e.end - e.addr < best.end - best.addr)) best = e;
    return best;
}

const named = new Map<number, { name: string; title?: string } | null>();

/** The name of WRAM offset `off` ($0000-$1FFFF): an exact symbol, a word's high byte, or a record smaller than a page. */
function wramName(off: number): { name: string; title?: string } | null {
    if (!named.has(off)) named.set(off, findWramName(off));
    return named.get(off)!;
}

function findWramName(off: number): { name: string; title?: string } | null {
    const field = getWramField(off);
    if (field) return { name: field.entry.name + field.path + (field.within ? '+' + field.within : ''), title: field.type + ' — ' + field.entry.summary };
    const exact = ramSymbols().find((s) => s.addr === off && s.name);
    if (exact) return { name: exact.name!, title: exact.summary };
    const near = ramSymbols().find((s) => s.name && (s.size || 2) <= 4 && off > s.addr && off < s.addr + (s.size || 2));
    if (near) return { name: plus(near.name!, off - near.addr), title: near.summary };
    const rec = smallestEntry(WRAM + off);
    if (rec && rec.name && rec.end - rec.addr + 1 < PAGE) return { name: plus(rec.name, WRAM + off - rec.addr), title: rec.title };
    return null;
}

/** The record or block that holds WRAM offset `off`, for grouping what an instruction touched. */
function wramGroup(off: number): string {
    const n = wramName(off);
    if (n) return n.name;
    const rec = smallestEntry(WRAM + off);
    return rec && rec.name ? rec.name : h(WRAM + off, 6);
}

/** The name of ROM bus address `bus`: a routine of this catalog, else (unmoved code) a table. */
function romName(cat: Catalog, bus: number, unmoved: boolean): string | null {
    return targetName(cat, bus, unmoved) || (unmoved ? (getTable(hiromFileOffset(bus))?.name ?? null) : null);
}

/** What the operand of `l` addresses (bus address), when it can be known; null for immediates, branches, registers. */
function operandAddress(mode: string, mnemonic: string, v: number, d: number, db: number | null): number | null {
    if (NO_DATA.test(mnemonic)) return null;
    if (DP_MODES.has(mode)) return WRAM + ((d + v) & 0xFFFF);
    if (mode === 'long' || mode === 'longx') return v;
    if (!ABS_DATA.has(mode) || ((mode === 'absx' || mode === 'absy') && v < PAGE)) return null;   // a record field off X/Y
    if ((v >= 0x2100 && v < 0x2200) || (v >= 0x4000 && v < 0x4400)) return v;                       // I/O (bank-less)
    if (v < 0x2000) return WRAM + v;
    return db === null ? null : (db << 16) | v;
}

function nameAt(cat: Catalog, bus: number, unmoved: boolean): Named | null {
    const bank = bus >>> 16, lo = bus & 0xFFFF, system = bank < 0x40 || (bank >= 0x80 && bank < 0xC0);
    if (system && lo < 0x2000) bus = WRAM + lo;                                          // low WRAM, mirrored in every system bank
    else if (system && lo < 0x8000) {
        const io = ioRegisterName(lo);
        return io ? { addr: h(lo, 4), name: io, title: 'hardware register' } : null;
    }
    if (bus >= WRAM && bus < 0x800000) {
        const n = wramName(bus - WRAM);
        return n ? { addr: h(bus, 6), ...n } : null;
    }
    const n = romName(cat, bus, unmoved);
    return n ? { addr: h(bus, 6), name: n } : null;
}

/**
 * What one instruction touched while recorded, grouped (its own pointer's bytes and interrupt vector fetches left out): the
 * bytes of one field are one item, the same field in several slots of a pool one group (`ENTITY_DYNAMIC_POOL[*].pos_y ×30`).
 */
function touched(cat: Catalog, xrefs: [number, number][], own: number | null, unmoved: boolean): Touch[] {
    const groups = new Map<string, Touch & { lo: number; hi: number; items: Set<string> }>();
    for (const [sa, flags] of xrefs) {
        const space = Math.floor(sa / 0x1000000), a = sa % 0x1000000;
        let bus: number, item: string;
        if (space === SPACE.WRAM) { bus = WRAM + a; if (own !== null && bus >= own && bus <= own + 2) continue; item = wramGroup(a).replace(/\+\d+$/, ''); }
        else if (space === SPACE.ROM) { if (a >= VECTORS && a < VECTORS + 0x20) continue; bus = 0xC00000 | a; item = romName(cat, bus, unmoved) || 'ROM'; }
        else continue;   // I/O and other buses: the hardware registers section lists them
        const key = item.replace(/\[\d+\]/g, '[*]');
        const access = (flags & XR.WRITE ? 'write' : '') || (flags & XR.READ ? 'read' : '');
        let g = groups.get(key);
        if (!g) { g = { name: item, addr: h(bus, 6), lo: bus, hi: bus, count: 0, access: '', items: new Set() }; groups.set(key, g); }
        g.hi = Math.max(g.hi, bus);
        if (bus < g.lo) { g.lo = bus; g.addr = h(bus, 6); }
        if (access && !g.access.includes(access)) g.access += (g.access ? '/' : '') + access;
        g.items.add(item === 'ROM' ? String(bus) : item);
        g.count = g.items.size;
        if (g.count > 1) g.name = key;
    }
    return [...groups.values()].sort((x, y) => y.count - x.count).map(({ lo, hi, items: _items, ...t }) => ({
        ...t, ...(t.name === 'ROM' ? { name: 'ROM ' + h(lo, 6) + (hi > lo ? '..' + h(hi, 6) : '') } : {}), ...(hi > lo ? { addr: t.addr + '..' + h(hi, 6) } : {}),
    }));
}

/** lines.json for `fn` (null: not in this ROM). */
function routineLinesJson(cat: Catalog, fn: CodeFunction, view: CdlView | null) {
    // With a library the listing is decoded with the widths each instruction ran with, not the 16-bit guess.
    const a = analyse(cat, fn, view ? (bus) => {
        const off = hiromFileOffset(bus);
        if (!(view.lib.ext[off] & EXT_HEAD)) return null;
        return { m8: !!(view.lib.cdl[off] & CDL_ACC8), x8: !!(view.lib.cdl[off] & CDL_IDX8) };
    } : undefined);
    if (!a) return null;
    const unmoved = fn.at.addr === fn.vanilla;
    let ran = 0;
    const lines = a.lines.map((l): Line => {
        const o = OPCODES[l.op], v = l.bytes.slice(1).reduceRight((acc, b) => acc * 256 + b, 0);
        const facts = view ? view.at(l.addr) || view.at(l.addr ^ 0x400000) : null;
        const d = facts && facts.d.length === 1 ? facts.d[0] : 0;
        const db = facts && facts.db.length === 1 ? facts.db[0] : null;
        const out: Line = { addr: h(l.addr, 6), bytes: l.bytes.map((b) => b.toString(16).padStart(2, '0')).join(' '), text: l.text, named: l.text };
        if (l.comment) out.comment = l.comment;
        const own = operandAddress(o.mode, o.mnemonic, v, d, db);
        const token = /(?<!#)\$[0-9A-F]+/.exec(l.text);
        if (l.name) {
            out.call = l.name;
            if (token) out.named = l.text.slice(0, token.index) + l.name + l.text.slice(token.index + token[0].length);
        } else if (own !== null && token) {
            const n = nameAt(cat, own, unmoved);
            if (n) { out.operand = n; out.named = l.text.slice(0, token.index) + n.name + l.text.slice(token.index + token[0].length); }
        }
        if (view) {
            const off = hiromFileOffset(l.addr), flags = view.lib.cdl[off] || 0;
            const hits = view.lib.hasHits ? view.lib.romHits[off] || 0 : (flags & CDL_CODE ? 1 : 0);
            if (flags & CDL_CODE) ran++;
            const all = facts ? touched(cat, facts.xrefs, own, unmoved) : [];
            const counted = facts ? [...facts.counts.values()].reduce((s, n) => s + n, 0) : 0;
            out.cdl = {
                hits, m8: !!(flags & CDL_ACC8), x8: !!(flags & CDL_IDX8),
                db: (facts?.db || []).map((x) => h(x, 2)), d: (facts?.d || []).map((x) => h(x, 4)),
                touched: all.slice(0, TOUCHED_MAX), more: Math.max(0, counted - (facts?.xrefs.length || 0)) + all.slice(TOUCHED_MAX).reduce((s, t) => s + t.count, 0),
            };
        }
        return out;
    });
    return { name: fn.name, addr: hex6(fn.at.addr as number), cdl: view ? { ran, of: lines.length } : null, lines };
}

export type { Line };
export { routineLinesJson };
