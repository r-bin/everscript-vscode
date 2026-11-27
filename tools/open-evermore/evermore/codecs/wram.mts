// The `wram` kind (docs/open-evermore/wram.md §0, memory.md §4.2): every named WRAM variable, written as a few region
// files, wram/<region>.json, each an ordered list of items from the region's start. The other kinds name WRAM through it:
// a script's cell (`write_word ENEMY_SPAWNER_QUANTITY, 1`), a record's `wram` field, a ring's buffer. Implode reads the
// files first and hands their addresses to those kinds, so a variable's place is written once, here.
//
// The regions and their spans come from the mapping file (`memory.wram` in evermore/map/<release>.json): where each starts
// and ends, and how the engine reaches it (direct page, the low mirror, the data bank $7E, long), which is what forces a
// variable into a region. A region file holds no address: each item's place follows from the order and the sizes.
//
// An item:
//   { "name": "PROJ_ALCHEMY_SLOTS_BASE", "type": "ProjAlchemySlot", "count": 8 }   size = type's size × count
//   { "name": "LEVEL_TABLE", "type": "u16", "count": 35, "cells": [{ "name": "LEVEL_ACID_RAIN", "offset": 0, "size": 2 }] }
//   { "name": "DOG_READ" }        a cell of unknown size (as wide as each access): it takes no room, the gap after it does
//   { "gap": 6 }                  bytes no variable is named for
//   "size" beside a type: the bytes when they are not the type's (an unknown type, a map entry that says otherwise)
// The types are wram/_types.json, exploded from the vanilla types (localizations/data/types.json): structs with their
// size, enums, typedefs; an item may use any of them or u8/i8/u16/i16/u24/u32.
//
// Moving or resizing is refused (`wram-moved`, `wram-resized`) until implode rewrites the code that reaches a variable
// (docs/todo/wram-allocation.md W2); a region that overflows its span is `wram-region-full`.
//
// The names are the ones the Scripts tab reads cells by (script-model/names.ts displayNames: names.json, then the
// compiler's MEMORY enum, then the knowledge WRAM map), plus the WRAM map's $7F entries; sizes and types are the WRAM map's
// (localizations/data/wram-map.md) for a variable that starts where its entry does. One name per address; a name the
// sources give two addresses is left out (both cells stay `$7E:xxxx`), as the scripts' operands already do.
import { createRequire } from 'node:module';
import type { Codec, ImplodeContext } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { json, readText } from '../../tree.mts';
import type { Tree } from '../../tree.mts';
import { hexText } from './readers.mts';
import * as map from '../map.mts';

const require = createRequire(import.meta.url);
const { displayNames } = require('../../../../dist/games/evermore/script-model/names');
const { getAllWramEntries } = require('../../../../dist/games/evermore/localizations/wram-map');
const VANILLA_TYPES = require('../../../../src/games/evermore/localizations/data/types.json');

export const KIND = 'wram';
const DIR = KIND, FORMAT = 'open-evermore/memory', TYPES_FORMAT = 'open-evermore/memory-types', VERSION = 1, TYPES = '_types.json';
const NAME = /^[A-Za-z_][A-Za-z0-9_]{0,79}$/;
const WRAM_START = 0x7E0000, TEMP_START = 0x7E2834, TEMP_END = 0x7E28FC;

/** One variable: `at` a bus address ($7E:0000-$7F:FFFF). */
export interface Variable { name: string; at: number; size: number | null; in?: string; offset?: number; type?: string }

let vanillaCache: Variable[] | null = null;
/** Every named variable of the vanilla game, by address. */
export function vanillaWram(): Variable[] {
    if (vanillaCache) return vanillaCache;
    const d = displayNames(() => 0);
    const entries: { busAddr: number; name: string; size: number; type: string }[] = getAllWramEntries();
    const entryAt = new Map(entries.map(e => [e.busAddr, e]));
    // An array or a struct keeps its own name when a script names its first cell otherwise (the formulas' levels:
    // LEVEL_HIGH_ACID_RAIN is the first of 35); a scalar's two names are one variable, the script's name.
    const whole = (e: { type: string } | undefined) => !!e && !/^`?(u8|u16|u24|u32|i8|i16|entity)`?$/.test(e.type ?? '');
    const cells: { name: string; at: number; size: number | null; type?: string }[] = [];
    for (let a = 0; a < 0x10000; a++) {
        const n: string = d.memory(a), at = WRAM_START | a, e = entryAt.get(at);
        if (!n) continue;
        if (e && e.name.toUpperCase() !== n.toUpperCase() && whole(e)) cells.push({ name: e.name, at, size: e.size, type: e.type }, { name: n, at, size: null });
        else cells.push({ name: n, at, size: e?.size ?? null, type: e?.type });
    }
    for (const e of entries) if (e.busAddr >= 0x7F0000 && e.name) cells.push({ name: e.name, at: e.busAddr, size: e.size, type: e.type });
    // temp[] (scripts write `temp[n]`, so displayNames names none of its cells): the WRAM map's one entry for it.
    for (const e of entries) if (e.busAddr >= TEMP_START && e.busAddr < TEMP_END && e.name) cells.push({ name: e.name, at: e.busAddr, size: e.size, type: e.type });
    const uses = new Map<string, number>();
    for (const c of cells) uses.set(c.name, (uses.get(c.name) ?? 0) + 1);
    // By address, the whole before its first cell.
    const list = cells.filter(c => uses.get(c.name) === 1 && NAME.test(c.name)).sort((a, b) => a.at - b.at || (b.size ?? 0) - (a.size ?? 0));
    // A variable that starts inside a sized one is in it.
    const out: Variable[] = [], open: Variable[] = [];
    for (const c of list) {
        while (open.length && open[open.length - 1].at + open[open.length - 1].size! <= c.at) open.pop();
        const parent = open[open.length - 1];
        let size: number | null = c.size;
        if (parent && size !== null && c.at + size > parent.at + parent.size!) size = null;
        const type = c.type?.replace(/`/g, '') || undefined;
        const v: Variable = parent ? { name: c.name, at: c.at, size, in: parent.name, offset: c.at - parent.at } : { name: c.name, at: c.at, size, ...(type && size !== null ? { type } : {}) };
        out.push(v);
        if (size !== null && size > 1) open.push(v);
    }
    const lower = new Map<string, string>();
    for (const v of out) {
        const other = lower.get(v.name.toLowerCase());
        if (other) throw new Error(`wram: "${v.name}" and "${other}" differ only in case; their files would be one on a case-insensitive disk`);
        lower.set(v.name.toLowerCase(), v.name);
    }
    return vanillaCache = out;
}

// ── the layout the other kinds read: the tree's when implode read the w// ── the layout the other kinds read: the tree's when implode read the wram kind, else vanilla's ──
interface Layout { at: Map<string, number>; name: Map<number, string>; list: Variable[] }
// An address in temp[] reads as `temp[n]` everywhere (scripts), never by the name of the block that holds it.
const inTemp = (at: number) => at >= TEMP_START && at < TEMP_END;
const layoutOf = (list: Variable[]): Layout => ({ at: new Map(list.map(v => [v.name, v.at])), name: new Map(list.filter(v => !inTemp(v.at)).map(v => [v.at, v.name])), list });
let current: Layout | null = null;
const layout = () => current ?? (current = layoutOf(vanillaWram()));

/** The bus address of a WRAM variable by name. */
export const wramAddress = (name: string): number | undefined => layout().at.get(name);
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

/** A variable's place as one number, for the round trip's `nameAt`: an array and its first cell share an address. */
const placeKey = (v: Variable): number => v.at * 0x10000 + (v.size ?? 0);
const at16 = (at: number) => hexText(at & 0xFFFF, 4, at >> 16);

// ── types: the sizes an item's type gives ──
interface Types { typedefs: Record<string, { type: string }>; enums: Record<string, { size?: number }>; structs: Record<string, { size: number }> }
const PRIMITIVE: Record<string, number> = { u8: 1, i8: 1, u16: 2, i16: 2, u24: 3, u32: 4, i32: 4 };
/** "u8[0xC8]" → { type: "u8", count: 200 }; "ProjAlchemySlot[8]"; "u16". */
function splitType(t: string): { type: string; count: number } | null {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)(?:\[(0x[0-9A-Fa-f]+|\d+)\])?$/.exec(t);
    return m ? { type: m[1], count: m[2] === undefined ? 1 : Number(m[2]) } : null;
}
/** The bytes of one element of a type, or null when the types do not say. */
function sizeOfType(type: string, types: Types, seen = new Set<string>()): number | null {
    if (PRIMITIVE[type]) return PRIMITIVE[type];
    if (seen.has(type)) return null;
    seen.add(type);
    if (types.structs?.[type]) return Number.isInteger(types.structs[type].size) ? types.structs[type].size : null;
    if (types.typedefs?.[type]) return sizeOfType(types.typedefs[type].type, types, seen);
    if (types.enums?.[type]) return Number.isInteger(types.enums[type].size) ? types.enums[type].size! : null;
    return null;
}
const knownType = (type: string, types: Types) => !!(PRIMITIVE[type] || types.structs?.[type] || types.typedefs?.[type] || types.enums?.[type]);

// ── the region files ──
interface Cell { name: string; offset: number; size?: number }
type Entry = { gap: number } | { name: string; type?: string; count?: number; size?: number; cells?: Cell[] };

/** The vanilla variables as region files: each item in order, gaps where nothing is named. Throws rather than lose one. */
function regionFiles(list: Variable[]): Map<string, Entry[]> {
    const regions = map.memory('wram'), out = new Map<string, Entry[]>(regions.map(r => [r.name, []]));
    const byName = new Map(list.map(v => [v.name, v]));
    const tops = list.filter(v => !v.in);
    const cellsOf = new Map<string, Cell[]>();
    const addCell = (parent: string, c: Cell) => { const l = cellsOf.get(parent) ?? []; l.push(c); cellsOf.set(parent, l); };
    for (const v of list) if (v.in) addCell(v.in, { name: v.name, offset: v.offset!, ...(v.size !== null ? { size: v.size } : {}) });
    const placed: { region: string; v: Variable }[] = [];
    let cursor = -1, last: Variable | null = null, region: map.Region | null = null;
    for (const v of tops) {
        const r = regions.find(x => x.from <= v.at && v.at < x.to);
        if (!r) throw new Error(`wram: ${v.name} at ${at16(v.at)} lies in no region of map memory.wram`);
        if (r !== region) { region = r; cursor = r.from; last = null; }
        if (v.at < cursor) {
            // a second name inside the item before it (DOG_READ on DOG_FORM_INDEX): one of its cells
            if (!last || v.at + (v.size ?? 1) > last.at + (last.size ?? 1)) throw new Error(`wram: ${v.name} at ${at16(v.at)} overlaps ${last?.name ?? 'the region start'}`);
            addCell(last.name, { name: v.name, offset: v.at - last.at, ...(v.size !== null ? { size: v.size } : {}) });
            byName.set(v.name, { ...v, in: last.name, offset: v.at - last.at });
            continue;
        }
        if (v.at + (v.size ?? 0) > r.to) throw new Error(`wram: ${v.name} (${at16(v.at)}, ${v.size} bytes) runs past region ${r.name}`);
        placed.push({ region: r.name, v });
        cursor = v.at + (v.size ?? 0);
        last = v;
    }
    const types = VANILLA_TYPES as Types;
    const ends = new Map<string, number>(regions.map(r => [r.name, r.from]));
    for (const { region: rn, v } of placed) {
        const items = out.get(rn)!, gap = v.at - ends.get(rn)!;
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
        ends.set(rn, v.at + (v.size ?? 0));
    }
    return out;
}

const regionFile = (region: string, items: Entry[]): Uint8Array => json({ format: FORMAT, version: VERSION, space: KIND, region, items });
const typesFile = (): Uint8Array => {
    const t = VANILLA_TYPES as any;
    return json({ format: TYPES_FORMAT, version: VERSION, typedefs: t.typedefs ?? {}, enums: t.enums ?? {}, structs: t.structs ?? {} });
};

/** The tree's variables: each region file read in order, each item placed (findings for whatever is wrong). */
function read(ctx: ImplodeContext, names: Set<string>): Variable[] {
    const { tree, findings } = ctx;
    let types: Types = VANILLA_TYPES as Types;
    const tpath = `${DIR}/${TYPES}`;
    if (tree.has(tpath)) {
        try {
            const t = JSON.parse(readText(tree.get(tpath)!));
            if (t?.format !== TYPES_FORMAT || t?.version !== VERSION) findings.error('schema', tpath, '/format', `"${TYPES_FORMAT}", version ${VERSION}`);
            else types = t;
        } catch (e) { findings.error('parse-error', tpath, '', (e as Error).message); }
    }
    const out: Variable[] = [], seen = new Set<string>();
    const named = (n: unknown, file: string, where: string): n is string => {
        if (typeof n !== 'string' || !NAME.test(n)) { findings.error('bad-name', file, where, `"${n}": letters, digits and _, at most 80`); return false; }
        if (seen.has(n)) { findings.error('duplicate-name', file, where, `"${n}" is named twice`); return false; }
        seen.add(n);
        return true;
    };
    for (const r of map.memory('wram')) {
        const file = `${DIR}/${r.name}.json`;
        if (!names.has(r.name)) { findings.error('missing-file', file, '', `region ${r.name} (${at16(r.from)}-${at16(r.to - 1)}) has no file`); continue; }
        let f: any;
        try { f = JSON.parse(readText(tree.get(file)!)); }
        catch (e) { findings.error('parse-error', file, '', (e as Error).message); continue; }
        if (f?.format !== FORMAT || f?.version !== VERSION || f?.space !== KIND || !Array.isArray(f?.items)) { findings.error('schema', file, '/format', `"${FORMAT}", version ${VERSION}, space "${KIND}", items [...]`); continue; }
        let cursor = r.from;
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
            const v: Variable = { name: it.name, at: cursor, size, ...(it.type ? { type: it.count && it.count !== 1 ? `${it.type}[${it.count}]` : it.type } : {}) };
            if (cursor + (size ?? 0) > r.to) findings.error('wram-region-full', file, where, `${it.name} ends at ${at16(cursor + (size ?? 0) - 1)}, past region ${r.name}'s ${at16(r.to - 1)} (${r.why})`);
            out.push(v);
            for (const [j, c] of (Array.isArray(it.cells) ? it.cells : []).entries()) {
                const cw = `${where}/cells/${j}`;
                if (!c || !named(c.name, file, cw + '/name')) continue;
                if (c.size !== undefined && !(Number.isInteger(c.size) && c.size > 0)) { findings.error('schema', file, cw + '/size', 'bytes, a whole number above 0'); continue; }
                if (!Number.isInteger(c.offset) || c.offset < 0 || c.offset + (c.size ?? 1) > Math.max(size ?? 1, 1)) { findings.error('schema', file, cw + '/offset', `bytes into ${it.name}, inside its ${size ?? '?'} bytes`); continue; }
                out.push({ name: c.name, at: cursor + c.offset, size: c.size ?? null, in: it.name, offset: c.offset });
            }
            cursor += size ?? 0;
        });
    }
    return out.sort((a, b) => a.at - b.at || (b.size ?? 0) - (a.size ?? 0));
}

export const wramCodec: Codec = {
    kind: KIND, version: VERSION, path: DIR, listedIdsOnly: true, nameRe: NAME,

    defaultName: id => `wram_${id.toString(16)}`,

    explode(_rom, _name, _options, _count, nameAt) {
        // WRAM does not move yet, so a round trip finds each variable where vanilla has it; nameAt keeps the tree's name.
        const list = vanillaWram().map(v => ({ ...v, name: nameAt(KIND, placeKey(v)) ?? v.name }));
        const renamed = new Map(vanillaWram().map((v, k) => [v.name, list[k].name]));
        for (const v of list) if (v.in) v.in = renamed.get(v.in) ?? v.in;
        current = layoutOf(list);
        const files: Tree = new Map();
        for (const [region, items] of regionFiles(list)) files.set(`${DIR}/${region}.json`, regionFile(region, items));
        files.set(`${DIR}/${TYPES}`, typesFile());
        files.set(`${DIR}/${ENUM}`, enumFile({ kind: KIND, limit: 0, names: [], why: 'a WRAM variable has no id: everything reaches it by name' }));
        return { files, pool: [], tables: [], homes: [] };
    },

    /** The region files present (wram/<region>.json). */
    names({ tree, findings }) {
        const names = new Set<string>(), regions = new Set(map.memory('wram').map(r => r.name));
        for (const path of tree.keys()) {
            if (!path.startsWith(DIR + '/') || path === `${DIR}/${ENUM}` || path === `${DIR}/${TYPES}`) continue;
            const m = /^wram\/([^/]+)\.json$/.exec(path);
            if (!m || !regions.has(m[1])) { findings.warning('unknown-file', path, '', `the WRAM regions are ${[...regions].join(', ')} (map memory.wram), each <region>.json; ignored`); continue; }
            names.add(m[1]);
        }
        return names;
    },

    // Reads the variables for the kinds after it; writes nothing (code still reaches each variable at its vanilla place).
    encode(ctx, names) {
        const list = read(ctx, names);
        // Renaming is free; a place is held as often as vanilla holds it (once). A variable on a vanilla place with another
        // size is resized; one on no vanilla place moved. Moves are told per region, the first few by name.
        const home = new Map<string, number>(), vanilla = new Map(vanillaWram().map(v => [v.name, v]));
        for (const v of vanillaWram()) home.set(`${v.at}:${v.size}`, (home.get(`${v.at}:${v.size}`) ?? 0) + 1);
        const moved = new Map<string, Variable[]>();
        const regions = map.memory('wram'), regionOf = (at: number) => regions.find(r => r.from <= at && at < r.to)?.name ?? KIND;
        for (const v of list) {
            const place = `${v.at}:${v.size}`, left = home.get(place) ?? 0;
            home.set(place, left - 1);
            if (left > 0) continue;
            const was = vanilla.get(v.name);
            if (was && was.at === v.at) { ctx.findings.error('wram-resized', `${DIR}/${regionOf(v.at)}.json`, '', `${v.name} at ${at16(v.at)} is ${v.size ?? '?'} bytes, vanilla's ${was.size ?? '?'}: WRAM does not resize yet (docs/todo/wram-allocation.md W2)`); continue; }
            const r = regionOf(v.at), l = moved.get(r) ?? [];
            l.push(v);
            moved.set(r, l);
        }
        for (const [r, l] of moved) {
            const first = l.slice(0, 3).map(v => `${v.name} → ${at16(v.at)}`).join(', ');
            ctx.findings.error('wram-moved', `${DIR}/${r}.json`, '', `${l.length} variable${l.length === 1 ? '' : 's'} left ${l.length === 1 ? 'its' : 'their'} vanilla place (${first}${l.length > 3 ? ', …' : ''}): WRAM does not move yet (docs/todo/wram-allocation.md W2)`);
        }
        current = layoutOf(list);
        return [];
    },

    symbols: () => new Map(layout().list.map(v => [`${KIND}/${v.name}`, placeKey(v)])),

    tables: () => [],
};
