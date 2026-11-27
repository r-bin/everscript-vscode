// Shared by the wram kind (wram.mts) and its moves (wram-moves.mts): the vanilla variables, the parts of the mapping file,
// the types. No state of a build here.
import { createRequire } from 'node:module';
import type { ImplodeContext } from '../../codec.mts';
import { hexText } from './readers.mts';
import * as map from '../map.mts';

const require = createRequire(import.meta.url);
const { displayNames } = require('../../../../dist/games/evermore/script-model/names');
const { getAllWramEntries } = require('../../../../dist/games/evermore/localizations/wram-map');
export const VANILLA_TYPES = require('../../../../src/games/evermore/localizations/data/types.json');

export const NAME = /^[A-Za-z_][A-Za-z0-9_]{0,79}$/;
export const WRAM_START = 0x7E0000, WRAM_END = 0x800000, TEMP_START = 0x7E2834, TEMP_END = 0x7E28FC;

export interface Variable { name: string; at: number; size: number | null; in?: string; offset?: number; type?: string; part?: string; home?: Variable }

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

/** A variable's place as one number, for the round trip's `nameAt`: an array and its first cell share an address. */
export const placeKey = (v: Variable): number => v.at * 0x10000 + (v.size ?? 0);
export const at16 = (at: number) => hexText(at & 0xFFFF, 4, at >> 16);

// ── types: the sizes an item's type gives ──
export interface Types { typedefs: Record<string, { type: string }>; enums: Record<string, { size?: number; values?: Record<string, string> } & Record<string, unknown>>; structs: Record<string, { size: number }> }
export const PRIMITIVE: Record<string, number> = { u8: 1, i8: 1, u16: 2, i16: 2, u24: 3, u32: 4, i32: 4 };
/** "u8[0xC8]" → { type: "u8", count: 200 }; "ProjAlchemySlot[8]"; "u16". */
export function splitType(t: string): { type: string; count: number } | null {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)(?:\[(0x[0-9A-Fa-f]+|\d+)\])?$/.exec(t);
    return m ? { type: m[1], count: m[2] === undefined ? 1 : Number(m[2]) } : null;
}
/** The bytes of one element of a type, or null when the types do not say. */
export function sizeOfType(type: string, types: Types, seen = new Set<string>()): number | null {
    if (PRIMITIVE[type]) return PRIMITIVE[type];
    if (seen.has(type)) return null;
    seen.add(type);
    if (types.structs?.[type]) return Number.isInteger(types.structs[type].size) ? types.structs[type].size : null;
    if (types.typedefs?.[type]) return sizeOfType(types.typedefs[type].type, types, seen);
    if (types.enums?.[type]) return Number.isInteger(types.enums[type].size) ? types.enums[type].size! : null;
    return null;
}
export const knownType = (type: string, types: Types) => !!(PRIMITIVE[type] || types.structs?.[type] || types.typedefs?.[type] || types.enums?.[type]);
/** An enum's values, either form of types.json ({ size, values: {…} } or the values alone). */
export const enumValues = (e: Record<string, unknown>): Record<string, unknown> => (e.values && typeof e.values === 'object' ? e.values : Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'size' && k !== 'desc'))) as Record<string, unknown>;

/** The tree's enums, checked: each value a number that fits the enum's size, each name once. */
export function checkEnums(types: Types, file: string, ctx: ImplodeContext): void {
    for (const [name, e] of Object.entries(types.enums ?? {})) {
        const where = `/enums/${name}`;
        if (!e || typeof e !== 'object') { ctx.findings.error('schema', file, where, 'an enum is { "size": bytes, "values": { "0x00": "NAME", … } }'); continue; }
        if (e.size !== undefined && !(Number.isInteger(e.size) && e.size >= 1 && e.size <= 4)) { ctx.findings.error('schema', file, where + '/size', 'bytes, 1-4'); continue; }
        const max = e.size ? 2 ** (8 * e.size) : 2 ** 32, seen = new Map<string, string>();
        for (const [v, n] of Object.entries(enumValues(e))) {
            const value = Number(v);
            if (!/^(0x[0-9A-Fa-f]+|\d+)$/.test(v) || value >= max) { ctx.findings.error('schema', file, `${where}/values/${v}`, `a value is a number below ${max} (the enum's ${e.size ?? '?'} bytes)`); continue; }
            if (typeof n !== 'string' || !NAME.test(n)) { ctx.findings.error('bad-name', file, `${where}/values/${v}`, `"${n}": letters, digits and _`); continue; }
            if (seen.has(n)) ctx.findings.error('duplicate-name', file, `${where}/values/${v}`, `${n} names ${seen.get(n)} too`);
            seen.set(n, v);
        }
    }
}

// ── the part files ──
export interface Cell { name: string; offset: number; size?: number }
export type Entry = { gap: number } | { name: string; type?: string; count?: number; size?: number; cells?: Cell[] };
export const partsOf = () => map.memory('wram').flatMap(r => r.parts.map(p => ({ ...p, region: r })));
/** The part a vanilla address lies in: the last whose start is not after it, in its region. */
export const partAt = (at: number) => { const ps = partsOf().filter(p => p.region.from <= at && at < p.region.to && p.from <= at); return ps[ps.length - 1]; };

/** Variables (the vanilla list, or it moved by the ROM) as part files: each top item in order, gaps where nothing is
 *  named. Throws rather than lose one. */
