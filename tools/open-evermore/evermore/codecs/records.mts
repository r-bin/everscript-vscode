// Kinds whose resources are fixed records the game reads in place, by id (docs/open-evermore/resources.md §equipment,
// §alchemy): one file per id, <kind>/<name>.json, each field by name; <kind>/_enum.json the ids. A field lives at
// `table + stride·id + offset` in the ROM, so a kind can be an array of records (weapons, armour) or parallel tables
// (the formulas' nine tables): the same description either way. Implode writes every field where it was; neither the
// count nor a record's place changes (their readers are code operands or WRAM holds a record's address).
//
// How a field is written:
//   number     a whole number (at most `max` when the reader uses less than the field's width)
//   hex        "$xxxx" (with `bank`: "$BB:xxxx")
//   text       a pointer to text in bank $C4: the text by reference, `strings/menu/<name>` (texts.mts owns the bytes;
//              records and ring items that show the same text name the same file)
//   target     the target cursor's rules ($05AD): the target by reference, `targets/<name>` (targets.mts)
//   ref        `scale`·id of another kind's entry (or of a fixed list `names`): `<folder>/<name>` (a list's entry bare)
//   wram       a WRAM address: the wram kind's variable, `wram/NAME`, `wram/NAME+n` for a byte inside it
//   routine    a 16-bit code address in `bank`: the routine's name (readers.mts `routines`)
// A field may apply to some ids only (`ids`); the bytes of the others stay in _base/. References are typed (links.mts):
// explode writes `<folder>/<name>`, implode reads that or the bare name.
import type { Codec, ImplodeContext, Span, Write } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { json, NAME_RE, readText } from '../../tree.mts';
import type { Tree } from '../../tree.mts';
import { link, unlink } from '../../links.mts';
import { ANIMATIONS, animationPlacedOffset, animationRef } from './animations.mts';
import { hexText, parseHex, routines } from './readers.mts';
import { SPRITE_PALETTES, spritePaletteAddr, spritePaletteName } from './sprite-palettes.mts';
import { addTargetSource, TARGETS, targetLink, targetValue } from './targets.mts';
import { addTextSource, TEXTS, textLink, textName, textPointer } from './texts.mts';
import { KIND as WRAM, wramAddress, wramHolding, wramName, wramSize } from './wram.mts';

const TEXT_BANK = 0x040000;
const ROUTINES = new Map<number, ReturnType<typeof routines>>();
const routinesOf = (bank: number) => ROUTINES.get(bank) ?? ROUTINES.set(bank, routines(bank)).get(bank)!;

export type Form =
    | { type: 'number'; max?: number }
    | { type: 'hex'; bank?: number }
    | { type: 'text' }
    | { type: 'target' }
    | { type: 'ref'; kind?: string; names?: readonly string[]; scale?: number }
    | { type: 'wram' }
    | { type: 'routine'; bank: number }
    | { type: 'sprite_palette'; optional?: boolean }
    | { type: 'animation'; optional?: boolean };

export interface Field {
    /** Where it goes in the file: "name", "cost/0/count" (a number segment makes an array). */
    path: string;
    /** File offset of id 0's field; id k's is `at + stride·k`. */
    at: number;
    stride: number;
    /** Bytes (default 2); 3: a 24-bit number (the experience tables). */
    width?: 1 | 2 | 3;
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
/** A WRAM address as a reference: `wram/NAME`, `wram/NAME+n`, or `$7E:xxxx` when no variable holds it. */
export function wramLink(at: number): string {
    const t = wramText(at);
    return t.startsWith('$') ? t : link(WRAM, t);
}
export function wramAt(ref: unknown): number | null {
    const text = typeof ref === 'string' && ref.startsWith('$') ? ref : unlink(WRAM, ref);
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

const word = (b: Uint8Array, at: number, width: number) => width === 1 ? b[at] : width === 3 ? b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) : b[at] | (b[at + 1] << 8);
/** A field's bytes, little-endian. */
const bytesOf = (x: number, width: number) => Uint8Array.from({ length: width }, (_, k) => (x >> (8 * k)) & 0xFF);

/** Every records kind's `prepare`: a kind's names may be asked for by another kind's explode first. */
const PREPARE: ((rom: Uint8Array) => void)[] = [];

export function recordsCodec(r: Records): Codec {
    if (r.prepare) PREPARE.push(r.prepare);
    const DIR = r.kind, applies = (f: Field, id: number) => id < r.count && (f.ids?.(id) ?? true);
    const fieldAt = (f: Field, id: number) => f.at + f.stride * id;
    const refNames = (form: Extract<Form, { type: 'ref' }>, ctx?: ImplodeContext) => form.names ? new Map(form.names.map((n, k) => [n, k])) : ctx?.ids.get(form.kind!);
    const ids = (f: Field) => Array.from({ length: r.count }, (_, id) => id).filter(id => applies(f, id));

    // The texts and targets this kind's records point at (texts.mts, targets.mts name them from every reader).
    for (const f of r.fields) {
        if (f.form.type === 'text') addTextSource(rom => ids(f).map(id => TEXT_BANK | word(rom, fieldAt(f, id), 2)));
        if (f.form.type === 'target') addTargetSource(rom => ids(f).map(id => word(rom, fieldAt(f, id), f.width ?? 2)));
    }

    /** A field's value as the file holds it → its number, or the reason it is none (a text: its name; an animation: its). */
    function value(f: Field, v: unknown, ctx: ImplodeContext): number | { text: string } | { anim: string } | { error: string } {
        const form = f.form, max = form.type === 'number' && form.max !== undefined ? form.max : 2 ** (8 * (f.width ?? 2)) - 1;
        switch (form.type) {
            case 'number': return Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max ? v as number : { error: `a whole number 0-${max}` };
            case 'hex': { const n = parseHex(v, max, form.bank); return n ?? { error: form.bank === undefined ? `"$${'x'.repeat(2 * (f.width ?? 2))}"` : `"$${form.bank.toString(16).toUpperCase()}:xxxx"` }; }
            case 'wram': return wramAt(v) ?? { error: 'a WRAM variable, "wram/NAME" (wram/), "wram/NAME+n" for a byte inside one, or "$7E:xxxx"' };
            case 'routine': return routinesOf(form.bank).at(v) ?? { error: `a routine of bank $${form.bank.toString(16).toUpperCase()} by name (soe://rom/code/), or "$${form.bank.toString(16).toUpperCase()}:xxxx"` };
            case 'sprite_palette': {
                if (form.optional && v === null) return 0;
                const pals = ctx.ids.get(SPRITE_PALETTES), n = unlink(SPRITE_PALETTES, v);
                if (pals && n !== undefined && !n.startsWith('$')) {
                    const id = pals.get(n);
                    return id !== undefined ? spritePaletteAddr(id) : { error: `"${v}" is no sprite palette in ${link(SPRITE_PALETTES, '')}` };
                }
                const x = parseHex(v, max);
                return x ?? { error: pals ? `a sprite palette, "${link(SPRITE_PALETTES, '<name>')}"${form.optional ? ' or null' : ''}` : '"$xxxx"' };
            }
            case 'animation': {
                if (form.optional && v === null) return 0;
                const anims = ctx.names.get(ANIMATIONS), n = unlink(ANIMATIONS, v);
                if (anims && n !== undefined && !n.startsWith('$')) return anims.has(n) ? { anim: n } : { error: `"${v}" is no animation in ${link(ANIMATIONS, '')}` };
                const x = parseHex(v, max, 0xC4);
                return x ?? { error: anims ? `an animation, "${link(ANIMATIONS, '<owner>/<name>')}"${form.optional ? ' or null' : ''}` : '"$C4:xxxx"' };
            }
            case 'text': {
                const n = textName(ctx, v);
                return n === undefined ? { error: `a text, "${link(TEXTS, '<name>')}" (one file there): the record points at it` } : { text: n };
            }
            case 'target': {
                const x = targetValue(ctx, v);
                return x === null || x > max ? { error: `a target, "${link(TARGETS, '<name>')}" (a file there, or a name its rules give)` } : x;
            }
            case 'ref': {
                const n = form.names ? (typeof v === 'string' ? v : undefined) : unlink(form.kind!, v);
                const id = n === undefined ? undefined : refNames(form, ctx)?.get(n);
                return id !== undefined && id * (form.scale ?? 1) <= max ? id * (form.scale ?? 1) : { error: form.names ? `one of ${form.names.slice(0, 4).join(', ')} …` : `an entry of ${form.kind}, "${link(form.kind!, '<name>')}"` };
            }
        }
    }

    function readFile(ctx: ImplodeContext, path: string): any | null {
        try { return JSON.parse(readText(ctx.tree.get(path)!)); } catch (e) { ctx.findings.error('parse-error', path, '', (e as Error).message); return null; }
    }

    return {
        kind: r.kind, version: 1, path: DIR, folder: `${r.group}/${DIR}`,
        defaultName: id => r.names()[id] ?? `${r.kind}_${id.toString(16).padStart(2, '0')}`,

        // The fields only (notes are for the reader); a reference typed or bare compares equal, a target by its word.
        canonical(path, bytes, ctx) {
            if (path === `${DIR}/${ENUM}`) return [path, bytes];
            const v = JSON.parse(readText(bytes)), out = {};
            for (const f of r.fields) {
                let x = getPath(v, f.path);
                if (x === undefined) continue;
                const t = f.form.type;
                if (t === 'target') x = targetValue(ctx, x) ?? x;
                else if (t === 'text') x = unlink(TEXTS, x) ?? x;
                else if (t === 'wram') x = wramAt(x) ?? x;
                else if (t === 'sprite_palette') x = unlink(SPRITE_PALETTES, x) ?? x;
                else if (t === 'animation') x = unlink(ANIMATIONS, x) ?? x;
                else if (t === 'ref' && f.form.kind) x = unlink(f.form.kind, x) ?? x;
                setPath(out, f.path, x);
            }
            return [path, json(out)];
        },

        explode(rom, name, _options, countOf, nameAt) {
            r.check?.(rom);
            for (const p of PREPARE) p(rom);
            const files: Tree = new Map(), names: string[] = [], tables: Span[] = [];
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
                        case 'wram': out = wramLink(x); break;
                        case 'routine': out = routinesOf(form.bank).name(x); break;
                        case 'sprite_palette': {
                            if (form.optional && !x) { out = null; break; }
                            let p: string | undefined;
                            try { p = spritePaletteName(rom, x, name, countOf, nameAt) ?? undefined; } catch { p = undefined; }
                            out = p ? link(SPRITE_PALETTES, p) : hexText(x, 2 * width);
                            break;
                        }
                        case 'animation': {
                            if (form.optional && !x) { out = null; break; }
                            const ref = animationRef(rom, x, name, countOf, nameAt);
                            if (ref?.facing) throw new Error(`${r.kind}: ${n} ${f.path} points at interior facing $${x.toString(16)}`);
                            out = ref ? link(ANIMATIONS, ref.animation) : hexText(x, 2 * width, 0xC4);
                            break;
                        }
                        case 'text': out = textLink(rom, TEXT_BANK | x, name, nameAt); break;
                        case 'target': out = targetLink(x); break;
                        case 'ref': {
                            const k = x / (form.scale ?? 1), list = form.names;
                            out = Number.isInteger(k) && (list ? k < list.length : true) ? (list ? list[k] : link(form.kind!, name(form.kind!, k))) : null;
                            if (out === null) throw new Error(`${r.kind}: ${n} ${f.path} holds $${x.toString(16)}, no entry; another release?`);
                        }
                    }
                    setPath(v, f.path, out);
                }
                const notes = r.notes?.(id);
                files.set(`${DIR}/${n}.json`, json(notes ? { ...v, ...notes } : v));
            }
            files.set(`${DIR}/${ENUM}`, enumFile({ kind: r.kind, limit: r.count, names, why: r.why }));
            return { files, pool: [], tables, homes: [] };
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

        // Fields are checked here; texts are the texts kind's items.
        encode(ctx, names) {
            const ids = ctx.ids.get(r.kind) ?? new Map<string, number>();
            for (const n of names) {
                const path = `${DIR}/${n}.json`, id = ids.get(n);
                if (!NAME_RE.test(n)) { ctx.findings.error('bad-name', path, '', `"${n}": snake_case, at most 80 characters`); continue; }
                if (id === undefined || id >= r.count) { ctx.findings.error('id-over-limit', path, '', `the game has ${r.count} (${r.why})`); continue; }
                const v = readFile(ctx, path);
                if (v === null) continue;
                for (const f of r.fields) {
                    if (!applies(f, id)) continue;
                    const x = value(f, getPath(v, f.path), ctx);
                    if (typeof x === 'object' && 'error' in x) ctx.findings.error(['ref', 'text', 'target', 'sprite_palette', 'animation'].includes(f.form.type) ? 'unknown-reference' : 'invalid-value', path, `/${f.path}`, x.error);
                }
            }
            return [];
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
                    if (typeof x === 'object' && 'text' in x) {
                        const p = textPointer(ctx, placed, x.text);
                        if (p === null) { ctx.findings.error('no-room', path, `/${f.path}`, `the text ${link(TEXTS, x.text)} was not placed in bank $C4, where this record reads it`); continue; }
                        x = p;
                    } else if (typeof x === 'object' && 'anim' in x) {
                        const off = animationPlacedOffset(ctx, placed, x.anim);
                        if (off === null) continue;
                        x = off;
                    }
                    writes.push({ at: fieldAt(f, id), bytes: bytesOf(x as number, f.width ?? 2), file: path });
                }
            }
            return writes;
        },
    };
}
