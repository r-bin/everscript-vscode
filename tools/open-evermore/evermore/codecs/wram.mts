// The `wram` kind (docs/open-evermore/wram.md §0, memory.md §4.2): every named WRAM variable, written as one file per part of
// WRAM by meaning, wram/<part>.json (the frame state, the palettes, the windows, the party, the entities, …), each an
// ordered list of items. The other kinds name WRAM through it: a script's cell (`write_word ENEMY_SPAWNER_QUANTITY, 1`), a
// record's `wram` field, a ring's buffer. Implode reads the files first and hands their addresses to those kinds.
//
// Where things are (the mapping file's `memory.wram`, evermore/map/<release>.json): the regions, cut where the engine's
// reach changes (direct page, the low mirror, the data bank $7E, long), each cut by meaning into parts, and the blocks the
// save routine copies. A file holds no address: an item's place follows from the order and the sizes, and a part starts at
// its vanilla start or, when the part before it grew past that, right after it (it spills over and pushes the parts after
// it). Every item must stay where the engine reaches it from its home region (`reach`), and inside or outside the saved
// blocks as vanilla had it (W8).
//
// An item:
//   { "name": "PROJ_ALCHEMY_SLOTS_BASE", "type": "ProjAlchemySlot", "count": 8 }   size = type's size × count
//   { "name": "LEVEL_TABLE", "type": "u16", "count": 35, "cells": [{ "name": "LEVEL_ACID_RAIN", "offset": 0, "size": 2 }] }
//   { "name": "DOG_READ" }        a cell of unknown size (as wide as each access): it takes no room, the gap after it does
//   { "gap": 6 }                  bytes no variable is named for; what follows a part's last item up to the next part is
//                                 free and not written
//   "size" beside a type: the bytes when they are not the type's (an unknown type, a map entry that says otherwise)
// The types are wram/_types.json, exploded from the vanilla types (localizations/data/types.json): structs, enums (with
// their values and size), typedefs. They are the tree's to change: an enum's values renamed or added, its `size` changed
// (every item of that type is resized with it). The ROM holds no type, so the round trip carries the tree's.
//
// Moving (docs/todo/wram-allocation.md W2): a variable moves when the reader census (evermore/map/<release>.wram-readers.json,
// tools/open-evermore/wram-census.mts) says implode can rewrite every operand that reaches it. Implode writes those
// operands from the new place (generated, in the table space explode recorded), and the round trip reads each place back
// from them. Variables one instruction reaches together are a group that moves rigidly. A pinned variable (a pointer, DMA,
// the direct page, a field read through X/Y) stays, and says why when the tree moves it (`wram-pinned`). A variable no
// recorded play reached moves freely (said as info). Growing is free where the following items can move (or a gap or the
// part's free end takes it); shrinking only where no recorded access reaches past the new end.
//
// The names are the ones the Scripts tab reads cells by (script-model/names.ts displayNames: names.json, then the
// compiler's MEMORY enum, then the knowledge WRAM map), plus the WRAM map's $7F entries; sizes and types are the WRAM map's
// (localizations/data/wram-map.md) for a variable that starts where its entry does. One name per address; a name the
// sources give two addresses is left out (both cells stay `$7E:xxxx`), as the scripts' operands already do.
import type { Codec, ImplodeContext, Write } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { json, readText } from '../../tree.mts';
import type { Tree } from '../../tree.mts';
import * as map from '../map.mts';
import { census, check, fromRom, groupStart, siteSpans } from './wram-moves.mts';
import type { Group, Moved } from './wram-moves.mts';
import { NAME, TEMP_END, TEMP_START, VANILLA_TYPES, WRAM_START, at16, checkEnums, enumValues, knownType, partAt, partsOf, placeKey, sizeOfType, splitType, vanillaWram } from './wram-vars.mts';
import type { Cell, Entry, Types, Variable } from './wram-vars.mts';
import type { Span } from '../../codec.mts';

export { vanillaWram } from './wram-vars.mts';
export type { Variable } from './wram-vars.mts';

export const KIND = 'wram';
const DIR = KIND, FORMAT = 'open-evermore/memory', TYPES_FORMAT = 'open-evermore/memory-types', VERSION = 1, TYPES = '_types.json';
/** The symbol that tells a round trip's explode that it reads back a tree implode just read (Codec.symbols → nameAt). */
const TREE_MARK = 0x7FFFFFFF, TREE_NAME = '__tree__';
/** Code sets this mark in `symbols()` when routines moved so WRAM round-trip ignores moved sites. */
export const CODE_MOVED_MARK = 0x7FFFFFFE, CODE_MOVED_NAME = '__moved__';
let movedCodeSpans: Span[] = [];
export const setMovedCodeHomes = (spans: Span[] | null): void => { movedCodeSpans = spans ?? []; };

// ── the layout the other kinds read: the tree's when implode read the wram kind, else vanilla's ──
interface Layout { at: Map<string, number>; name: Map<number, string>; list: Variable[] }
// An address in temp[] reads as `temp[n]` everywhere (scripts), never by the name of the block that holds it.
const inTemp = (at: number) => at >= TEMP_START && at < TEMP_END;
const layoutOf = (list: Variable[]): Layout => ({ at: new Map(list.map(v => [v.name, v.at])), name: new Map(list.filter(v => !inTemp(v.at)).map(v => [v.at, v.name])), list });
let current: Layout | null = null;
const layout = () => current ?? (current = layoutOf(vanillaWram().map(v => ({ ...v, home: v }))));

/** The bus address of a WRAM variable by name. */
export const wramAddress = (name: string): number | undefined => layout().at.get(name);
/** All variables in the current layout. */
export const currentWram = (): Variable[] => layout().list;
/** Active WRAM types/enums/structs from the tree, or vanilla's. */
export const currentTypes = (): Types => (lastRead?.types as Types | null) ?? (VANILLA_TYPES as Types);
/** Symbolic WRAM expression for an instruction operand at current bus address `addr`. */
export function wramSymbolExpr(addr: number, length: 2 | 3 = 3, bank?: number): string | null {
    const list = layout().list;
    const exact = list.find(v => v.at === addr && !v.in) ?? list.find(v => v.at === addr);
    let expr: string | null = exact ? exact.name : null;
    if (!expr) {
        const h = wramHolding(addr);
        if (h) expr = h.offset ? `${h.name}+$${h.offset.toString(16).toUpperCase()}` : h.name;
    }
    if (!expr) return null;
    return length === 3 && bank === 0 ? `${expr}-$7E0000` : expr;
}

/** Symbolic WRAM expression for a vanilla WRAM address (handles renames/moves on round-trip). */
export function wramSymbolForVanilla(vanillaAddr: number, length: 2 | 3, bank?: number): string | null {
    const list = layout().list;
    const exact = list.find(v => (v.home?.at ?? v.at) === vanillaAddr && !v.in) ?? list.find(v => (v.home?.at ?? v.at) === vanillaAddr);
    let expr: string | null = exact ? exact.name : null;
    if (!expr) {
        let best: Variable | null = null;
        for (const v of list) {
            const h = v.home;
            if (h && h.size !== null && h.at <= vanillaAddr && vanillaAddr < h.at + h.size && (!best || h.size < best.home!.size!)) best = v;
        }
        if (best) {
            const off = vanillaAddr - best.home!.at;
            expr = off ? `${best.name}+$${off.toString(16).toUpperCase()}` : best.name;
        }
    }
    if (!expr) return null;
    return length === 3 && bank === 0 ? `${expr}-$7E0000` : expr;
}
/** A variable's size in bytes (null: as wide as each access; undefined: no such variable). */
export const wramSize = (name: string): number | null | undefined => { const at = layout().at.get(name); return at === undefined ? undefined : layout().list.find(v => v.name === name)!.size; };
/** The variable that starts at a bus address, by name ('' when none). */
export const wramName = (at: number): string => layout().name.get(at) ?? '';
/** The smallest sized variable that holds a bus address, and the byte's offset in it. */
export function wramHolding(at: number): { name: string; offset: number } | null {
    let best: Variable | null = null;
    for (const v of layout().list) if (v.size !== null && v.at <= at && at < v.at + v.size && (!best || v.size < best.size!)) best = v;
    return best ? { name: best.name, offset: at - best.at } : null;
}
/** The vanilla address of the byte at bus address `at` in the current layout (what knowledge keyed by address knows it
 *  by: a cell's named values), or undefined when no vanilla variable holds it. */
export function wramVanilla(at: number): number | undefined {
    for (const v of layout().list) if (!v.in && v.home && v.size !== null && v.at <= at && at < v.at + v.size) return at - v.at < (v.home.size ?? 0) ? v.home.at + at - v.at : undefined;
    return undefined;
}

// Script cells written as numbers (`<0x2391>`, `[91 23]`) do not follow a move: noted while scripts encode, checked in tables.
const numbered = new Set<number>();
/** A script names WRAM bus address `at` by number. */
export const noteNumberedCell = (at: number): void => { numbered.add(at); };


function partFiles(list: Variable[]): Map<string, Entry[]> {
    const parts = partsOf(), out = new Map<string, Entry[]>(parts.map(p => [p.name, []]));
    const cellsOf = new Map<string, Cell[]>();
    const addCell = (parent: string, c: Cell) => { const l = cellsOf.get(parent) ?? []; l.push(c); cellsOf.set(parent, l); };
    for (const v of list) if (v.in) addCell(v.in, { name: v.name, offset: v.offset!, ...(v.size !== null ? { size: v.size } : {}) });
    const tops = list.filter(v => !v.in).sort((a, b) => a.at - b.at || (b.size ?? 0) - (a.size ?? 0));
    const placed: { part: string; v: Variable; gap: number }[] = [];
    let cursor = -1, last: Variable | null = null, part: string | null = null;
    for (const v of tops) {
        const p = partAt(v.at);
        if (!p) throw new Error(`wram: ${v.name} at ${at16(v.at)} lies in no part of map memory.wram`);
        if (p.name !== part) {
            // A part starts at its vanilla start, or after the part before it in the same bank when that one ran on.
            const prevEnd = last && last.at >> 16 === p.from >> 16 ? last.at + (last.size ?? 0) : p.from;
            cursor = Math.max(p.from, prevEnd); part = p.name;
            if (v.at >= cursor) last = null;
        }
        if (v.at < cursor) {
            // a second name inside the item before it (DOG_READ on DOG_FORM_INDEX): one of its cells
            if (!last || v.at + (v.size ?? 1) > last.at + (last.size ?? 1)) throw new Error(`wram: ${v.name} at ${at16(v.at)} overlaps ${last?.name ?? 'the part start'}`);
            addCell(last.name, { name: v.name, offset: v.at - last.at, ...(v.size !== null ? { size: v.size } : {}) });
            continue;
        }
        if (v.at + (v.size ?? 0) > ((v.at >> 16) + 1) << 16) throw new Error(`wram: ${v.name} (${at16(v.at)}, ${v.size} bytes) runs past its bank`);
        placed.push({ part: p.name, v, gap: v.at - cursor });
        cursor = v.at + (v.size ?? 0);
        last = v;
    }
    const types = VANILLA_TYPES as Types;
    for (const { part: pn, v, gap } of placed) {
        const items = out.get(pn)!;
        if (gap > 0) items.push({ gap });
        const e: Entry = { name: v.name };
        const t = v.type ? splitType(v.type) : null;
        if (t && knownType(t.type, types)) {
            e.type = t.type;
            if (t.count !== 1) e.count = t.count;
            const one = sizeOfType(t.type, types);
            if (one === null || one * t.count !== v.size) e.size = v.size!;
        } else if (v.size !== null) e.size = v.size;
        const cells = cellsOf.get(v.name);
        if (cells) e.cells = cells.sort((a, b) => a.offset - b.offset);
        items.push(e);
    }
    return out;
}

const partFile = (part: string, items: Entry[]): Uint8Array => {
    const p = partsOf().find(x => x.name === part)!;
    return json({ format: FORMAT, version: VERSION, space: KIND, region: p.region.name, part, what: p.what, items });
};
const typesFile = (t: any = VANILLA_TYPES): Uint8Array => json({ format: TYPES_FORMAT, version: VERSION, typedefs: t.typedefs ?? {}, enums: t.enums ?? {}, structs: t.structs ?? {} });

/** The tree as read: its variables placed (findings for whatever is wrong), its files and types as written. */
interface Read { list: Variable[]; files: Map<string, unknown>; types: unknown }

/** The tree's variables: each part file read in order, each item placed. */
function read(ctx: ImplodeContext, names: Set<string>): Read {
    const { tree, findings } = ctx;
    let types: Types = VANILLA_TYPES as Types, typesRaw: unknown = null;
    const tpath = `${DIR}/${TYPES}`;
    if (tree.has(tpath)) {
        try {
            const t = JSON.parse(readText(tree.get(tpath)!));
            if (t?.format !== TYPES_FORMAT || t?.version !== VERSION) findings.error('schema', tpath, '/format', `"${TYPES_FORMAT}", version ${VERSION}`);
            else { types = t; typesRaw = t; checkEnums(types, tpath, ctx); }
        } catch (e) { findings.error('parse-error', tpath, '', (e as Error).message); }
    }
    const out: Variable[] = [], seen = new Set<string>(), files = new Map<string, unknown>();
    const named = (n: unknown, file: string, where: string): n is string => {
        if (typeof n !== 'string' || !NAME.test(n)) { findings.error('bad-name', file, where, `"${n}": letters, digits and _, at most 80`); return false; }
        if (seen.has(n)) { findings.error('duplicate-name', file, where, `"${n}" is named twice`); return false; }
        seen.add(n);
        return true;
    };
    let cursor = 0;
    for (const r of map.memory('wram')) {
        if (r.from >> 16 !== cursor >> 16) cursor = r.from;
        for (const p of r.parts) {
            const file = `${DIR}/${p.name}.json`;
            cursor = Math.max(cursor, p.from);
            if (!names.has(p.name)) { findings.error('missing-file', file, '', `part ${p.name} (${p.what}) has no file`); continue; }
            let f: any;
            try { f = JSON.parse(readText(tree.get(file)!)); }
            catch (e) { findings.error('parse-error', file, '', (e as Error).message); continue; }
            if (f?.format !== FORMAT || f?.version !== VERSION || f?.space !== KIND || !Array.isArray(f?.items)) { findings.error('schema', file, '/format', `"${FORMAT}", version ${VERSION}, space "${KIND}", items [...]`); continue; }
            files.set(file, f);
            f.items.forEach((it: any, k: number) => {
                const where = `/items/${k}`;
                if (it && typeof it === 'object' && 'gap' in it) {
                    if (!Number.isInteger(it.gap) || it.gap <= 0) findings.error('schema', file, where + '/gap', 'bytes, a whole number above 0');
                    else cursor += it.gap;
                    return;
                }
                if (!it || typeof it !== 'object' || !named(it.name, file, where + '/name')) return;
                let size: number | null = null;
                if (it.type !== undefined && (typeof it.type !== 'string' || !knownType(it.type, types))) { findings.error('unknown-type', file, where + '/type', `"${it.type}" is no type of ${tpath} nor u8/i8/u16/i16/u24/u32`); return; }
                if (it.count !== undefined && !(Number.isInteger(it.count) && it.count > 0)) { findings.error('schema', file, where + '/count', 'a whole number above 0'); return; }
                if (it.size !== undefined) {
                    if (!(Number.isInteger(it.size) && it.size > 0)) { findings.error('schema', file, where + '/size', 'bytes, a whole number above 0'); return; }
                    size = it.size;
                } else if (it.type !== undefined) {
                    const one = sizeOfType(it.type, types);
                    if (one === null) { findings.error('schema', file, where + '/size', `type ${it.type} has no size: give "size"`); return; }
                    size = one * (it.count ?? 1);
                } else if (it.count !== undefined) { findings.error('schema', file, where + '/count', 'a count needs a type'); return; }
                const bankEnd = ((cursor >> 16) + 1) << 16;
                if (cursor + (size ?? 0) > bankEnd) findings.error('wram-region-full', file, where, `${it.name} ends at ${at16(cursor + (size ?? 0) - 1)}, past bank $${(cursor >> 16).toString(16).toUpperCase()}: the parts before it hold more than the bank`);
                const v: Variable = { name: it.name, at: cursor, size, part: p.name, ...(it.type ? { type: it.count && it.count !== 1 ? `${it.type}[${it.count}]` : it.type } : {}) };
                out.push(v);
                for (const [j, c] of (Array.isArray(it.cells) ? it.cells : []).entries()) {
                    const cw = `${where}/cells/${j}`;
                    if (!c || !named(c.name, file, cw + '/name')) continue;
                    if (c.size !== undefined && !(Number.isInteger(c.size) && c.size > 0)) { findings.error('schema', file, cw + '/size', 'bytes, a whole number above 0'); continue; }
                    if (!Number.isInteger(c.offset) || c.offset < 0 || c.offset + (c.size ?? 1) > Math.max(size ?? 1, 1)) { findings.error('schema', file, cw + '/offset', `bytes into ${it.name}, inside its ${size ?? '?'} bytes`); continue; }
                    out.push({ name: c.name, at: cursor + c.offset, size: c.size ?? null, in: it.name, offset: c.offset, part: p.name });
                }
                cursor += size ?? 0;
            });
        }
    }
    return { list: out.sort((a, b) => a.at - b.at || (b.size ?? 0) - (a.size ?? 0)), files, types: typesRaw };
}

/** Ties each tree variable to the vanilla one it is: by name, else by place (a rename in place). */
function identify(list: Variable[]): void {
    const vanilla = vanillaWram(), byName = new Map(vanilla.map(v => [v.name, v])), claimed = new Set<Variable>();
    for (const v of list) { const h = byName.get(v.name); if (h) { v.home = h; claimed.add(h); } }
    const byPlace = new Map(vanilla.filter(v => !claimed.has(v)).map(v => [`${v.in ? 'c' : 't'}${placeKey(v)}`, v]));
    for (const v of list) if (!v.home) { const h = byPlace.get(`${v.in ? 'c' : 't'}${placeKey(v)}`); if (h && !claimed.has(h)) { v.home = h; claimed.add(h); } }
}

let lastRead: Read | null = null, lastMoves: Moved[] = [];

export const wramCodec: Codec = {
    kind: KIND, version: VERSION, path: DIR, listedIdsOnly: true, nameRe: NAME,

    defaultName: id => `wram_${id.toString(16)}`,

    explode(rom, _name, _options, _count, nameAt) {
        // Each movable group's place is in the ROM: the operands implode wrote (vanilla's on a vanilla ROM).
        const vanilla = vanillaWram(), deltas = new Map<Group, number>();
        const tree = nameAt(KIND, TREE_MARK) === TREE_NAME ? lastRead : null;
        const skipMoved = tree && nameAt('code', CODE_MOVED_MARK) === CODE_MOVED_NAME ? movedCodeSpans : [];
        if (rom.length) for (const g of census().groups) {
            const at = groupStart(rom, g, skipMoved);
            if (at === null) throw new Error(`wram: the operands that reach ${at16(g.from)}-${at16(g.to - 1)} disagree on where it is (another release, or code changed there)`);
            if (at !== g.from) deltas.set(g, at - g.from);
        }
        const deltaOf = (v: Variable) => { for (const [g, d] of deltas) if (v.at >= g.from && v.at < g.to) return d; return 0; };
        const files: Tree = new Map();
        // A round trip of a tree implode just read: the ROM holds no type, size or gap, only the places of what moves.
        // The tree's files come back when every place the ROM gives is the tree's; else the ROM's places are written.
        if (tree && lastMoves.every(m => !m.now || !census().groups.some(g => m.home.at >= g.from && m.home.at < g.to) || m.now.at - m.home.at === deltaOf(m.home))) {
            for (const [path, f] of tree.files) files.set(path, json(f));
            files.set(`${DIR}/${TYPES}`, typesFile(tree.types ?? VANILLA_TYPES));
            current = layoutOf(tree.list);
        } else {
            const list = fromRom(vanilla, deltas).map(v => ({ ...v, name: nameAt(KIND, placeKey(v)) ?? v.name }));
            const renamed = new Map(list.map(v => [v.home!.name, v.name]));
            for (const v of list) if (v.in) v.in = renamed.get(v.in) ?? v.in;
            current = layoutOf(list);
            for (const [part, items] of partFiles(list)) files.set(`${DIR}/${part}.json`, partFile(part, items));
            files.set(`${DIR}/${TYPES}`, typesFile(tree?.types ?? VANILLA_TYPES));
        }
        files.set(`${DIR}/${ENUM}`, enumFile({ kind: KIND, limit: 0, names: [], why: 'a WRAM variable has no id: everything reaches it by name' }));
        return { files, pool: [], tables: siteSpans(), homes: [] };
    },

    /** The part files present (wram/<part>.json). */
    names({ tree, findings }) {
        const names = new Set<string>(), parts = new Set(partsOf().map(p => p.name));
        for (const path of tree.keys()) {
            if (!path.startsWith(DIR + '/') || path === `${DIR}/${ENUM}` || path === `${DIR}/${TYPES}`) continue;
            const m = /^wram\/([^/]+)\.json$/.exec(path);
            if (!m || !parts.has(m[1])) { findings.warning('unknown-file', path, '', `the WRAM parts are ${[...parts].join(', ')} (map memory.wram), each <part>.json; ignored`); continue; }
            names.add(m[1]);
        }
        return names;
    },

    // Reads the variables for the kinds after it; the operands that reach what moved are written in `tables`.
    encode(ctx, names) {
        numbered.clear();
        const r = read(ctx, names);
        identify(r.list);
        lastMoves = check(ctx, r.list);
        lastRead = r;
        // prove's original: the tree's names at vanilla's places (the playbacks were recorded on it).
        if (ctx.vanillaMemory) {
            const fresh = r.list.filter(v => !v.home);
            if (fresh.length) ctx.findings.error('wram-prove', `${DIR}/`, '', `prove compares a moved WRAM with vanilla's: ${fresh[0].name} is new`);
            current = layoutOf(r.list.map(v => v.home ? { ...v, at: v.home.at, size: v.home.size } : v));
            lastMoves = lastMoves.map(m => ({ home: m.home, now: m.now ? { ...m.now, at: m.home.at, size: m.home.size } : null }));
        } else current = layoutOf(r.list);
        return [];
    },

    symbols: () => new Map([...layout().list.map(v => [`${KIND}/${v.name}`, placeKey(v)] as [string, number]), [`${KIND}/${TREE_NAME}`, TREE_MARK]]),

    defines() {
        const labels = new Map<string, number>();
        for (const v of layout().list) labels.set(v.name, v.at);
        const defines = new Map<string, number>(), types = currentTypes();
        for (const [enumName, e] of Object.entries(types.enums ?? {})) {
            for (const [valStr, valName] of Object.entries(enumValues(e as Record<string, unknown>))) {
                if (typeof valName !== 'string' || !NAME.test(valName)) continue;
                const num = Number(valStr);
                if (!Number.isNaN(num)) defines.set(`ENUM_${enumName}_${valName}`, num);
            }
        }
        for (const [structName, s] of Object.entries(types.structs ?? {}) as [string, { size: number; fields?: { offset: number; name: string }[] }][]) {
            if (Number.isInteger(s?.size)) defines.set(`STRUCT_${structName}_SIZE`, s.size);
            if (Array.isArray(s?.fields)) for (const f of s.fields) {
                if (typeof f?.name === 'string' && NAME.test(f.name) && Number.isInteger(f.offset)) defines.set(`STRUCT_${structName}_${f.name}`, f.offset);
            }
        }
        return { labels, defines };
    },

    /** Every operand of the census, from where its group is now (vanilla's when nothing moved), skipping sites owned by `code`. */
    tables(ctx) {
        const out: Write[] = [];
        const moved = new Map(lastMoves.filter(m => m.now).map(m => [m.home, m.now!.at - m.home.at]));
        const tops = vanillaWram().filter(v => !v.in);
        const owned = ctx.marks?.get('code/owned-sites');
        for (const g of census().groups) {
            const first = tops.find(v => v.at >= g.from && v.at < g.to);
            const delta = first ? moved.get(first) ?? 0 : 0;
            if (delta) for (const a of numbered) if (a >= g.from && a < g.to) ctx.findings.error('wram-script-number', `${DIR}/${partAt(g.from)?.name ?? KIND}.json`, '', `${first!.name} moved, but a script names ${at16(a)} by number: write it by name`);
            for (const s of g.sites) {
                if (owned?.has((s.file + 1).toString(16))) continue;
                const v = g.from + delta + s.offset;
                const bank = s.bank === undefined ? null : s.bank === 0x7E || s.bank === 0x7F ? v >> 16 : s.bank;
                const bytes = s.length === 3 ? [v & 0xFF, (v >> 8) & 0xFF, bank!] : [v & 0xFF, (v >> 8) & 0xFF];
                out.push({ at: s.file + 1, bytes: new Uint8Array(bytes), file: `${DIR}/${partAt(g.from)?.name ?? KIND}.json` });
            }
        }
        return out;
    },

    changed: () => lastMoves.some(m => !m.now || m.now.at !== m.home.at || m.now.size !== m.home.size),

    /** WRAM as the build has it against vanilla, for the proof: each vanilla variable's bytes and where they went. */
    memoryMoves: () => lastMoves.filter(m => m.home.size).map(m => ({ a: m.home.at - WRAM_START, b: m.now ? m.now.at - WRAM_START : -1, length: m.now ? Math.min(m.home.size!, m.now.size ?? 0) : 0, size: m.home.size! }))
        .filter(m => m.b !== m.a || m.length !== m.size),
};
