// The `wram` kind (docs/open-evermore/wram.md): every named WRAM variable, one file each, wram/<NAME>.json. The other
// kinds name WRAM through it: a script's cell (`write_word ENEMY_SPAWNER_QUANTITY, 1`), a record's `wram` field, a
// ring's buffer. Implode reads the files first and hands their addresses to those kinds, so a variable's place is
// written once, here. Moving one is the next step (docs/todo/wram-allocation.md W2): until implode rewrites the code
// that reaches a variable, a variable that left its vanilla place is an error.
//
// A file:
//   at      "$7E:0133": where it starts
//   in      "DIRECT_PAGE_BLOCK", with `offset`: a variable inside another (a struct's field, a cell of a block); it
//           moves with the one it is in
//   size    bytes, when known (else the cell is as wide as each access)
//
// The names are the ones the Scripts tab reads cells by (script-model/names.ts displayNames: names.json, then the
// compiler's MEMORY enum, then the knowledge WRAM map), plus the WRAM map's $7F entries; sizes are the WRAM map's
// (localizations/data/wram-map.md) for a variable that starts where its entry does. One name per address; a name the
// sources give two addresses is left out (both cells stay `$7E:xxxx`), as the scripts' operands already do.
import { createRequire } from 'node:module';
import type { Codec, ImplodeContext } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { json, readText } from '../../tree.mts';
import type { Tree } from '../../tree.mts';
import { hexText } from './readers.mts';

const require = createRequire(import.meta.url);
const { displayNames } = require('../../../../dist/games/evermore/script-model/names');
const { getAllWramEntries } = require('../../../../dist/games/evermore/localizations/wram-map');

export const KIND = 'wram';
const DIR = KIND, FORMAT = 'open-evermore/wram', VERSION = 1;
const NAME = /^[A-Za-z_][A-Za-z0-9_]{0,79}$/;
const WRAM_START = 0x7E0000, WRAM_END = 0x800000;

/** One variable: `at` a bus address ($7E:0000-$7F:FFFF). */
export interface Variable { name: string; at: number; size: number | null; in?: string; offset?: number }

let vanillaCache: Variable[] | null = null;
/** Every named variable of the vanilla game, by address. */
export function vanillaWram(): Variable[] {
    if (vanillaCache) return vanillaCache;
    const d = displayNames(() => 0);
    const map: { busAddr: number; name: string; size: number; type: string }[] = getAllWramEntries();
    const entryAt = new Map(map.map(e => [e.busAddr, e]));
    // An array or a struct keeps its own name when a script names its first cell otherwise (the formulas' levels:
    // LEVEL_HIGH_ACID_RAIN is the first of 35); a scalar's two names are one variable, the script's name.
    const whole = (e: { type: string } | undefined) => !!e && !/^`?(u8|u16|u24|u32|i8|i16|entity)`?$/.test(e.type ?? '');
    const cells: { name: string; at: number; size: number | null }[] = [];
    for (let a = 0; a < 0x10000; a++) {
        const n: string = d.memory(a), at = WRAM_START | a, e = entryAt.get(at);
        if (!n) continue;
        if (e && e.name.toUpperCase() !== n.toUpperCase() && whole(e)) cells.push({ name: e.name, at, size: e.size }, { name: n, at, size: null });
        else cells.push({ name: n, at, size: e?.size ?? null });
    }
    for (const e of map) if (e.busAddr >= 0x7F0000 && e.name) cells.push({ name: e.name, at: e.busAddr, size: e.size });
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
        const v: Variable = parent ? { name: c.name, at: c.at, size, in: parent.name, offset: c.at - parent.at } : { name: c.name, at: c.at, size };
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

// ── the layout the other kinds read: the tree's when implode read the wram kind, else vanilla's ──
interface Layout { at: Map<string, number>; name: Map<number, string>; list: Variable[] }
const layoutOf = (list: Variable[]): Layout => ({ at: new Map(list.map(v => [v.name, v.at])), name: new Map(list.map(v => [v.at, v.name])), list });
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

/** A variable's file: where it is (at, or in + offset) and its size. */
const fileOf = (v: Variable): Uint8Array => json({
    format: FORMAT, version: VERSION,
    ...(v.in ? { in: v.in, offset: v.offset } : { at: hexText(v.at & 0xFFFF, 4, v.at >> 16) }),
    ...(v.size !== null ? { size: v.size } : {}),
});

/** The tree's variables: each file read and its place resolved (findings for whatever is wrong). */
function read(ctx: ImplodeContext, names: Set<string>): Variable[] {
    const { tree, findings } = ctx;
    const raw = new Map<string, any>();
    for (const n of names) {
        const file = `${DIR}/${n}.json`;
        let v: any;
        try { v = JSON.parse(readText(tree.get(file)!)); }
        catch (e) { findings.error('parse-error', file, '', (e as Error).message); continue; }
        if (v?.format !== FORMAT || v?.version !== VERSION) { findings.error('schema', file, '/format', `"${FORMAT}", version ${VERSION}`); continue; }
        if (!NAME.test(n)) { findings.error('bad-name', file, '', `"${n}": letters, digits and _, at most 80`); continue; }
        if ((v.at === undefined) === (v.in === undefined)) { findings.error('schema', file, '', '"at": "$7E:xxxx", or "in": <variable> with "offset"'); continue; }
        if (v.size !== undefined && !(Number.isInteger(v.size) && v.size > 0)) { findings.error('schema', file, '/size', 'bytes, a whole number above 0'); continue; }
        raw.set(n, v);
    }
    const out = new Map<string, Variable>(), resolving = new Set<string>();
    const resolve = (n: string): Variable | null => {
        if (out.has(n)) return out.get(n)!;
        const v = raw.get(n), file = `${DIR}/${n}.json`;
        if (!v || resolving.has(n)) return null;
        resolving.add(n);
        let at: number | null = null;
        if (v.at !== undefined) {
            const m = typeof v.at === 'string' ? /^\$(7[EF]):([0-9A-Fa-f]{4})$/.exec(v.at) : null;
            if (!m) findings.error('schema', file, '/at', '"$7E:xxxx" or "$7F:xxxx"');
            else at = (parseInt(m[1], 16) << 16) | parseInt(m[2], 16);
        } else {
            const parent = typeof v.in === 'string' ? resolve(v.in) : null;
            if (!parent) findings.error('unknown-name', file, '/in', `"${v.in}" is no wram variable${resolving.has(v.in) ? ' (it is in this one)' : ''}`);
            else if (!Number.isInteger(v.offset) || v.offset < 0 || (parent.size !== null && v.offset + (v.size ?? 1) > parent.size)) findings.error('schema', file, '/offset', `bytes into ${v.in}, inside its ${parent.size ?? '?'} bytes`);
            else at = parent.at + v.offset;
        }
        resolving.delete(n);
        if (at === null) return null;
        if (at + (v.size ?? 1) > WRAM_END) { findings.error('schema', file, '/size', 'runs past $7F:FFFF'); return null; }
        const r: Variable = { name: n, at, size: v.size ?? null, ...(v.in !== undefined ? { in: v.in, offset: v.offset } : {}) };
        out.set(n, r);
        return r;
    };
    for (const n of raw.keys()) resolve(n);
    return [...out.values()].sort((a, b) => a.at - b.at);
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
        for (const v of list) files.set(`${DIR}/${v.name}.json`, fileOf(v));
        files.set(`${DIR}/${ENUM}`, enumFile({ kind: KIND, limit: 0, names: [], why: 'a WRAM variable has no id: everything reaches it by name' }));
        return { files, pool: [], tables: [], homes: [] };
    },

    names({ tree, findings }) {
        const names = new Set<string>();
        for (const path of tree.keys()) {
            if (!path.startsWith(DIR + '/') || path === `${DIR}/${ENUM}`) continue;
            const m = /^wram\/([^/]+)\.json$/.exec(path);
            if (!m) { findings.warning('unknown-file', path, '', 'a WRAM variable is one <NAME>.json; ignored'); continue; }
            names.add(m[1]);
        }
        return names;
    },

    // Reads the variables for the kinds after it; writes nothing (code still reaches each variable at its vanilla place).
    encode(ctx, names) {
        const list = read(ctx, names);
        // Renaming is free; a place is held as often as vanilla holds it (once), so a move onto another's place fails too.
        const home = new Map<string, number>();
        for (const v of vanillaWram()) home.set(`${v.at}:${v.size}`, (home.get(`${v.at}:${v.size}`) ?? 0) + 1);
        for (const v of list) {
            const place = `${v.at}:${v.size}`, left = home.get(place) ?? 0;
            home.set(place, left - 1);
            if (left > 0) continue;
            ctx.findings.error('wram-moved', `${DIR}/${v.name}.json`, '', `${hexText(v.at & 0xFFFF, 4, v.at >> 16)}${v.size ? `, ${v.size} bytes` : ''} is ${left < 0 ? 'another variable\'s place' : 'no vanilla variable\'s place'}: WRAM does not move yet (docs/todo/wram-allocation.md W2)`);
        }
        current = layoutOf(list);
        return [];
    },

    symbols: () => new Map(layout().list.map(v => [`${KIND}/${v.name}`, placeKey(v)])),

    tables: () => [],
};
