// Kinds whose resources are fixed records the game reads in place, by id (docs/open-evermore/resources.md §equipment,
// §alchemy): one file per id, <kind>/<name>.json, each field by name; <kind>/_enum.json the ids. A field lives at
// `table + stride·id + offset` in the ROM, so a kind can be an array of records (weapons, armour) or parallel tables
// (the formulas' nine tables): the same description either way. Implode writes every field where it was; neither the
// count nor a record's place changes (their readers are code operands or WRAM holds a record's address).
//
// How a field is written:
//   number     a whole number (at most `max` when the reader uses less than the field's width)
//   hex        "$xxxx" (with `bank`: "$BB:xxxx")
//   ring_text  a pointer to text in bank $C4 that a ring item shows: the ring item by name (menus.mts owns the text)
//   text       a pointer to text in bank $C4 no ring item shows: the text itself, written where it was (at most as long);
//              a record that shares an earlier record's text says so by name, { "same_as": <record> }
//   ref        `scale`·id of another kind's entry (or of a fixed list `names`): its name
//   wram       a WRAM address: the wram kind's variable by name, "+n" for a byte inside it
//   routine    a 16-bit code address in `bank`: the routine's name (readers.mts `routines`)
// A field may apply to some ids only (`ids`); the bytes of the others stay in _base/.
import type { Codec, CountOf, ImplodeContext, Item, NameAt, NameOf, Span, Write } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { json, NAME_RE, readText, sha1 } from '../../tree.mts';
import type { Tree } from '../../tree.mts';
import { ANIMATION_GROUPS, animationGroupPlacedOffset, animationGroupRef } from './animation-groups.mts';
import { hexText, parseHex, routines } from './readers.mts';
import { RING_ITEMS, ringItemNameKey, ringItemTexts } from './menus.mts';
import { SPRITE_PALETTES, spritePaletteAddr, spritePaletteName } from './sprite-palettes.mts';
import { wramAddress, wramHolding, wramName, wramSize } from './wram.mts';

const TEXT_BANK = 0x040000;
const ROUTINES = new Map<number, ReturnType<typeof routines>>();
const routinesOf = (bank: number) => ROUTINES.get(bank) ?? ROUTINES.set(bank, routines(bank)).get(bank)!;

export type Form =
    | { type: 'number'; max?: number }
    | { type: 'hex'; bank?: number }
    | { type: 'ring_text' }
    | { type: 'text' }
    | { type: 'ref'; kind?: string; names?: readonly string[]; scale?: number }
    | { type: 'wram' }
    | { type: 'routine'; bank: number }
    | { type: 'sprite_palette'; optional?: boolean }
    | { type: 'animation_group'; optional?: boolean };

export interface Field {
    /** Where it goes in the file: "name", "cost/0/count" (a number segment makes an array). */
    path: string;
    /** File offset of id 0's field; id k's is `at + stride·k`. */
    at: number;
    stride: number;
    width?: 1 | 2;
    form: Form;
    /** The ids that have this field (default: all). */
    ids?: (id: number) => boolean;
}

export interface Records {
    kind: string;
    /** `<group>/<kind>` in the tree. */
    group: string;
    count: number;
    /** The names explode gives, by id (read once `prepare` ran). */
    names: () => readonly string[];
    /** Reads what the names come from (the ROM's own text), before any kind explodes. */
    prepare?: (rom: Uint8Array) => void;
    fields: Field[];
    why: string;
    /** What a record is, for the reader (not compared), per id. */
    notes?: (id: number) => Record<string, unknown> | undefined;
    /** Throws when the ROM is not the release these offsets were read from. */
    check?: (rom: Uint8Array) => void;
}

// ── WRAM names: the wram kind's variables ──
/** `NAME`, `NAME+n` (inside a sized variable), or `$7E:xxxx`. */
export function wramText(at: number): string {
    const bus = 0x7E0000 | at, exact = wramName(bus);
    if (exact) return exact;
    const inside = wramHolding(bus);
    return inside ? `${inside.name}+${inside.offset}` : hexText(at, 4, 0x7E);
}
export function wramAt(text: unknown): number | null {
    if (typeof text !== 'string') return null;
    const m = /^([A-Za-z_][A-Za-z0-9_]*)(?:\+(\d+))?$/.exec(text);
    if (m) {
        const at = wramAddress(m[1]), size = wramSize(m[1]);
        if (at === undefined || at >> 16 !== 0x7E) return null;
        const offset = Number(m[2] ?? 0);
        return offset < (size ?? 1) ? (at + offset) & 0xFFFF : null;
    }
    return parseHex(text, 0xFFFF, 0x7E);
}

// ── paths in a JSON value ──
const segments = (path: string) => path.split('/').map(s => /^\d+$/.test(s) ? Number(s) : s);
function getPath(v: any, path: string): unknown {
    for (const s of segments(path)) { if (v === null || typeof v !== 'object') return undefined; v = v[s]; }
    return v;
}
function setPath(v: any, path: string, value: unknown): void {
    const ss = segments(path);
    ss.slice(0, -1).forEach((s, k) => { v = v[s] ??= typeof ss[k + 1] === 'number' ? [] : {}; });
    v[ss[ss.length - 1]] = value;
}

const word = (b: Uint8Array, at: number, width: number) => width === 1 ? b[at] : b[at] | (b[at + 1] << 8);
function textAt(rom: Uint8Array, at: number, what: string): string {
    let s = '';
    for (let i = at; rom[i] !== 0; i++) {
        if (rom[i] < 0x20 || rom[i] > 0x7E) throw new Error(`${what}: the text at $C4:${hexText(at & 0xFFFF, 4)} has byte $${rom[i].toString(16)}; explode would lose it`);
        s += String.fromCharCode(rom[i]);
    }
    return s;
}

/** Every records kind's `prepare`: a kind's names may be asked for by another kind's explode first. */
const PREPARE: ((rom: Uint8Array) => void)[] = [];

export function recordsCodec(r: Records): Codec {
    if (r.prepare) PREPARE.push(r.prepare);
    const DIR = r.kind, applies = (f: Field, id: number) => id < r.count && (f.ids?.(id) ?? true);
    const fieldAt = (f: Field, id: number) => f.at + f.stride * id;
    const textKey = (n: string, f: Field) => `${DIR}/${n}.${f.path.replace(/\//g, '.')}`;
    const refNames = (form: Extract<Form, { type: 'ref' }>, ctx?: ImplodeContext) => form.names ? new Map(form.names.map((n, k) => [n, k])) : ctx?.ids.get(form.kind!);

    /** A field's value as the file holds it → its number, or the reason it is none (text fields: their text). */
    function value(f: Field, v: unknown, ctx: ImplodeContext): number | string | { same: string } | { anim: string } | { error: string } {
        const form = f.form, max = form.type === 'number' && form.max !== undefined ? form.max : (f.width ?? 2) === 1 ? 0xFF : 0xFFFF;
        switch (form.type) {
            case 'number': return Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max ? v as number : { error: `a whole number 0-${max}` };
            case 'hex': { const n = parseHex(v, max, form.bank); return n ?? { error: form.bank === undefined ? `"$${'x'.repeat(2 * (f.width ?? 2))}"` : `"$${form.bank.toString(16).toUpperCase()}:xxxx"` }; }
            case 'wram': return wramAt(v) ?? { error: 'a WRAM name (knowledge wram/), "NAME+n" for a byte inside one, or "$7E:xxxx"' };
            case 'routine': return routinesOf(form.bank).at(v) ?? { error: `a routine of bank $${form.bank.toString(16).toUpperCase()} by name (soe://rom/code/), or "$${form.bank.toString(16).toUpperCase()}:xxxx"` };
            case 'sprite_palette': {
                if (form.optional && v === null) return 0;
                const pals = ctx.ids.get(SPRITE_PALETTES);
                if (pals && typeof v === 'string' && !v.startsWith('$')) {
                    const id = pals.get(v);
                    return id !== undefined ? spritePaletteAddr(id) : { error: `"${v}" is no sprite palette in palettes/sprites/` };
                }
                const n = parseHex(v, max);
                return n ?? { error: pals ? `a sprite palette name${form.optional ? ' or null' : ''}` : '"$xxxx"' };
            }
            case 'animation_group': {
                if (form.optional && v === null) return 0;
                const groups = ctx.names.get(ANIMATION_GROUPS);
                if (groups && typeof v === 'string' && !v.startsWith('$')) {
                    return groups.has(v) ? { anim: v } : { error: `"${v}" is no animation group in animations/groups/` };
                }
                const n = parseHex(v, max, 0xC4);
                return n ?? { error: groups ? `an animation group name${form.optional ? ' or null' : ''}` : '"$C4:xxxx"' };
            }
            case 'text': {
                const same = (v as { same_as?: unknown } | null)?.same_as;
                if (typeof same === 'string') return ctx.ids.get(r.kind)?.has(same) ? { same } : { error: `"${same}" is no ${r.kind} entry` };
                return typeof v === 'string' && /^[\x20-\x7E]*$/.test(v) ? v : { error: 'the text, printable ASCII, or { "same_as": <entry> } for another entry\'s' };
            }
            case 'ring_text': {
                const id = typeof v === 'string' ? ctx.ids.get(RING_ITEMS)?.get(v) : undefined;
                if (id === undefined) return { error: 'a ring item by name (menus/ring_items/): the record shows that item\'s text' };
                return v as string;
            }
            case 'ref': {
                const id = typeof v === 'string' ? refNames(form, ctx)?.get(v) : undefined;
                return id !== undefined && id * (form.scale ?? 1) <= max ? id * (form.scale ?? 1) : { error: form.names ? `one of ${form.names.slice(0, 4).join(', ')} …` : `an entry of ${form.kind} by name` };
            }
        }
    }

    /** Whether a record holds its own text in field `f` (not `same_as` another's). */
    const ownsText = (ctx: ImplodeContext, n: string, f: Field) => { const v = readFile(ctx, `${DIR}/${n}.json`); return typeof getPath(v, f.path) === 'string'; };
    /** Where a record's own text was: by its name, or (renamed) the home of the same rank among the records that own
     *  one, homes being in id order. */
    function homeOf(ctx: ImplodeContext, n: string, f: Field, id: number) {
        const suffix = `.${f.path.replace(/\//g, '.')}`, byId = new Map([...(ctx.ids.get(r.kind) ?? [])].map(([m, k]) => [k, m]));
        const rank = Array.from({ length: id }, (_, k) => k).filter(k => applies(f, k) && byId.has(k) && ownsText(ctx, byId.get(k)!, f)).length;
        return ctx.base.homes.get(textKey(n, f)) ?? [...ctx.base.homes].filter(([k]) => k.startsWith(`${DIR}/`) && k.endsWith(suffix))[rank]?.[1];
    }

    function readFile(ctx: ImplodeContext, path: string): any | null {
        try { return JSON.parse(readText(ctx.tree.get(path)!)); } catch (e) { ctx.findings.error('parse-error', path, '', (e as Error).message); return null; }
    }

    return {
        kind: r.kind, version: 1, path: DIR, folder: `${r.group}/${DIR}`,
        defaultName: id => r.names()[id] ?? `${r.kind}_${id.toString(16).padStart(2, '0')}`,

        // The fields only (notes are for the reader); a ref by name and the same ref spelt alike compare equal.
        canonical(path, bytes) {
            if (path === `${DIR}/${ENUM}`) return [path, bytes];
            const v = JSON.parse(readText(bytes)), out = {};
            for (const f of r.fields) { const x = getPath(v, f.path); if (x !== undefined) setPath(out, f.path, x); }
            return [path, json(out)];
        },

        explode(rom, name, _options, countOf, nameAt) {
            r.check?.(rom);
            for (const p of PREPARE) p(rom);
            const texts = ringItemTexts(rom), files: Tree = new Map(), names: string[] = [], tables: Span[] = [], pool: Span[] = [], homes = [];
            const owners = new Map<string, Map<number, string>>();
            for (let id = 0; id < r.count; id++) {
                const n = name(r.kind, id), v: Record<string, unknown> = {};
                names.push(n);
                for (const f of r.fields) {
                    if (!applies(f, id)) continue;
                    const at = fieldAt(f, id), width = f.width ?? 2, x = word(rom, at, width), form = f.form;
                    tables.push({ start: at, end: at + width });
                    let out: unknown;
                    switch (form.type) {
                        case 'number': out = x; break;
                        case 'hex': out = hexText(x, 2 * width, form.bank); break;
                        case 'wram': out = wramText(x); break;
                        case 'routine': out = routinesOf(form.bank).name(x); break;
                        case 'sprite_palette': {
                            if (form.optional && !x) { out = null; break; }
                            try { out = spritePaletteName(rom, x, name, countOf, nameAt) ?? null; }
                            catch { out = hexText(x, 2 * width); }
                            break;
                        }
                        case 'animation_group': {
                            if (form.optional && !x) { out = null; break; }
                            const ref = animationGroupRef(rom, x, name, countOf, nameAt);
                            if (ref?.facing) throw new Error(`${r.kind}: ${n} ${f.path} points at interior facing $${x.toString(16)}`);
                            out = ref ? ref.group : hexText(x, 2 * width, 0xC4);
                            break;
                        }
                        case 'ring_text': {
                            const item = texts.get(x);
                            if (item === undefined) throw new Error(`${r.kind}: ${n} ${f.path} points at $C4:${hexText(x, 4)}, which no ring item shows; another release?`);
                            out = name(RING_ITEMS, item); break;
                        }
                        case 'text': {
                            if (texts.has(x)) throw new Error(`${r.kind}: ${n} ${f.path} is a ring item's text; make the field ring_text`);
                            const own = owners.get(f.path) ?? owners.set(f.path, new Map()).get(f.path)!;
                            if (own.has(x)) { out = { same_as: own.get(x) }; break; }
                            own.set(x, n);
                            const t = textAt(rom, TEXT_BANK | x, r.kind), home = TEXT_BANK | x;
                            out = t;
                            pool.push({ start: home, end: home + t.length + 1 });
                            homes.push({ key: textKey(n, f), at: home, length: t.length + 1, sha1: sha1(rom.slice(home, home + t.length + 1)) });
                            break;
                        }
                        case 'ref': {
                            const k = x / (form.scale ?? 1), list = form.names;
                            out = Number.isInteger(k) && (list ? k < list.length : true) ? (list ? list[k] : name(form.kind!, k)) : null;
                            if (out === null) throw new Error(`${r.kind}: ${n} ${f.path} holds $${x.toString(16)}, no entry; another release?`);
                        }
                    }
                    setPath(v, f.path, out);
                }
                const notes = r.notes?.(id);
                files.set(`${DIR}/${n}.json`, json(notes ? { ...v, ...notes } : v));
            }
            files.set(`${DIR}/${ENUM}`, enumFile({ kind: r.kind, limit: r.count, names, why: r.why }));
            return { files, pool, tables, homes };
        },

        names({ tree, findings }) {
            const names = new Set<string>();
            for (const path of tree.keys()) {
                if (!path.startsWith(DIR + '/') || path === `${DIR}/${ENUM}`) continue;
                const m = new RegExp(`^${DIR}/([^/]+)\\.json$`).exec(path);
                if (m) names.add(m[1]); else findings.warning('unknown-file', path, '', `a ${r.kind} entry is <name>.json; ignored`);
            }
            return names;
        },

        // Fields are checked here; each own text becomes an item at its home.
        encode(ctx, names) {
            const ids = ctx.ids.get(r.kind) ?? new Map<string, number>(), items: Item[] = [];
            const byHome = new Map<number, { key: string; text: string; length: number; file: string; from: string }>();
            for (const n of names) {
                const path = `${DIR}/${n}.json`, id = ids.get(n);
                if (!NAME_RE.test(n)) { ctx.findings.error('bad-name', path, '', `"${n}": snake_case, at most 80 characters`); continue; }
                if (id === undefined || id >= r.count) { ctx.findings.error('id-over-limit', path, '', `the game has ${r.count} (${r.why})`); continue; }
                const v = readFile(ctx, path);
                if (v === null) continue;
                for (const f of r.fields) {
                    if (!applies(f, id)) continue;
                    const x = value(f, getPath(v, f.path), ctx);
                    if (typeof x === 'object' && 'error' in x) { ctx.findings.error(f.form.type === 'ref' || f.form.type === 'ring_text' || /^"/.test(x.error) ? 'unknown-reference' : 'invalid-value', path, `/${f.path}`, x.error); continue; }
                    if (f.form.type !== 'text') continue;
                    if (typeof x === 'object' && 'same' in x) {
                        if (!ownsText(ctx, x.same, f)) ctx.findings.error('unknown-reference', path, `/${f.path}/same_as`, `"${x.same}" has no text of its own here (it is same_as another): name the one that has`);
                        continue;
                    }
                    const home = homeOf(ctx, n, f, id);
                    if (!home) { ctx.findings.error('no-room', path, `/${f.path}`, 'no text of this record in the base'); continue; }
                    if ((x as string).length + 1 > home.length) { ctx.findings.error('no-room', path, `/${f.path}`, `at most ${home.length - 1} characters: the text is written where it was`); continue; }
                    const seen = byHome.get(home.at);
                    if (seen) { ctx.findings.error('no-room', path, `/${f.path}`, `${seen.from} has its text where this one was: one of them may be { "same_as": … } the other`); continue; }
                    byHome.set(home.at, { key: textKey(n, f), text: x as string, length: home.length, file: path, from: `${DIR}/${n}.json` });
                }
            }
            for (const [at, h] of byHome) {
                const bytes = new Uint8Array(h.length);
                for (let i = 0; i < h.text.length; i++) bytes[i] = h.text.charCodeAt(i);
                items.push({ key: h.key, file: h.file, bytes, rule: { above: at, below: at + h.length, bankOffset: at & 0xFFFF } });
            }
            return items;
        },

        tables(ctx, placed) {
            const ids = ctx.ids.get(r.kind);
            if (!ids) return [];
            if (ids.size !== r.count) ctx.findings.error('missing-file', `${DIR}/${ENUM}`, '', `all ${r.count}: each has its place in the tables`);
            const writes: Write[] = [];
            for (const [n, id] of ids) {
                if (id >= r.count) continue;
                const path = `${DIR}/${n}.json`, v = readFile(ctx, path);
                if (v === null) continue;
                for (const f of r.fields) {
                    if (!applies(f, id)) continue;
                    let x = value(f, getPath(v, f.path), ctx);
                    if (typeof x === 'object' && 'error' in x) continue;
                    if (f.form.type === 'ring_text') {
                        const key = ringItemNameKey(x as string), at = placed.get(key) ?? ctx.base.homes.get(key)?.at;
                        if (at === undefined) { ctx.findings.error('unknown-reference', path, `/${f.path}`, `the text of ring item "${x}" was not placed (explode menus/ring_items with this kind)`); continue; }
                        x = at & 0xFFFF;
                    } else if (f.form.type === 'text') {
                        const owner = typeof x === 'object' && 'same' in x ? x.same : n;
                        const home = homeOf(ctx, owner, f, ctx.ids.get(r.kind)!.get(owner)!);
                        if (!home) continue;
                        x = home.at & 0xFFFF;
                    } else if (typeof x === 'object' && 'anim' in x) {
                        const off = animationGroupPlacedOffset(ctx, placed, x.anim);
                        if (off === null) continue;
                        x = off;
                    }
                    const width = f.width ?? 2, n16 = x as number;
                    writes.push({ at: fieldAt(f, id), bytes: width === 1 ? Uint8Array.of(n16) : Uint8Array.of(n16 & 0xFF, n16 >> 8), file: path });
                }
            }
            return writes;
        },
    };
}
