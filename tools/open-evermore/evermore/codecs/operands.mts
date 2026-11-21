// A script command's operands as text for the scripts kind (docs/open-evermore/resources.md §scripts), one per
// operand token of the opcode (script-vm/spec.ts), separated by commas: an expression in infix with names
// (expressions.mts), a number, or a name where the parameter (script-vm/parameters.json) refers to something —
// another kind's resource by its name (its type's `kind`: a string, a sound, an animation, an enemy, a projectile),
// a constant of its enum. `[85 23 04]` is the operand's bytes as they are, always valid. Explode writes each operand
// the readable way only when reading it back gives the same bytes.
import { createRequire } from 'node:module';
import { cellText, cellValue, constBytes, exprBytes, exprText, shortConst } from './expressions.mts';
import type { Area, ExprNames } from './expressions.mts';

const require = createRequire(import.meta.url);
const PARAMETERS: Record<string, any> = require('../../../../src/games/evermore/script-vm/parameters.json');
const { displayNames, constantName } = require('../../../../dist/games/evermore/script-model/names');
const { ownEnum } = require('../../../../dist/games/evermore/script-vm/parameters');
const COMPILER: Record<string, { name: string; value: string }[]> = require('../../../../src/games/evermore/language/data/index.json').enums;

export interface Param { name: string; type: string; enum?: string; hex?: boolean }
/** A resource of another kind by its id: name → id and back (undefined: none). */
export interface Refs { name(kind: string, id: number): string | undefined; id(kind: string, name: string): number | undefined }

/** The opcode's parameters, aligned with its operand tokens; [] when parameters.json does not list one per token. */
export function paramsOf(opcode: number, tokens: number): Param[] {
    const p = PARAMETERS['0x' + opcode.toString(16).padStart(2, '0')]?.params ?? [];
    return p.length === tokens ? p : [];
}
/** What a parameter's value refers to: a kind's id times `scale` (parameters.json `types`). */
function kindOf(p: Param | undefined): { kind: string; scale: number; below?: number } | undefined {
    const t = p && PARAMETERS.types?.[p.type];
    return t?.kind ? { kind: t.kind, scale: t.scale ?? 1, below: t.below === undefined ? undefined : Number(t.below) } : undefined;
}

/** A WRAM cell or flag the parameter is (parameters.json `types`: `wram` the area, `flag`). */
function wramOf(p: Param | undefined): { area: Area; flag: boolean } | undefined {
    const t = p && PARAMETERS.types?.[p.type];
    return t?.wram ? { area: t.wram, flag: !!t.flag } : undefined;
}

// ── names of WRAM cells, flags and fields: the Scripts tab's, kept only where a name reads back to one thing ──
let wram: { mem: Map<number, string>; memOf: Map<string, number>; flag: Map<string, string>; flagOf: Map<string, { addr: number; mask: number }>; field: Map<number, string>; fieldOf: Map<string, number> } | null = null;
function wramNames() {
    if (wram) return wram;
    const d = displayNames(() => 0);
    const unique = <K, V>(pairs: [K, V][], same: (a: V, b: V) => boolean) => {
        const out = new Map<K, V>(), bad = new Set<K>();
        for (const [k, v] of pairs) { if (bad.has(k)) continue; const w = out.get(k); if (w !== undefined && !same(w, v)) { out.delete(k); bad.add(k); } else out.set(k, v); }
        return out;
    };
    const mems: [string, number][] = [], flags: [string, { addr: number; mask: number }][] = [], fields: [string, number][] = [];
    for (let a = 0; a < 0x10000; a++) { const n = d.memory(a); if (n) mems.push([n, a]); }
    for (let a = 0x2258; a < 0x2258 + 0x2000; a++) for (let b = 0; b < 8; b++) { const n = d.flag(a, 1 << b); if (n) flags.push([n, { addr: a, mask: 1 << b }]); }
    for (let o = 0; o < 0x100; o++) { const n = d.field(o); if (n) fields.push([n, o]); }
    const memOf = unique(mems, (x, y) => x === y), flagOf = unique(flags, (x, y) => x.addr === y.addr && x.mask === y.mask), fieldOf = unique(fields, (x, y) => x === y);
    // A name that is both a cell and a flag reads as neither.
    for (const n of [...memOf.keys()]) if (flagOf.has(n)) { memOf.delete(n); flagOf.delete(n); }
    wram = {
        mem: new Map([...memOf].map(([n, a]) => [a, n])), memOf,
        flag: new Map([...flagOf].map(([n, f]) => [`${f.addr}:${f.mask}`, n])), flagOf,
        field: new Map([...fieldOf].map(([n, o]) => [o, n])), fieldOf,
    };
    return wram;
}

/** The names expressions use: WRAM's, and entities by the entities kind. */
export function exprNames(refs: Refs, entities: string): ExprNames {
    const w = wramNames();
    return {
        entity: op => refs.name(entities, op), entityOf: n => refs.id(entities, n),
        memory: a => w.mem.get(a) ?? '', memoryOf: n => w.memOf.get(n),
        flag: (a, m) => w.flag.get(`${a}:${m}`) ?? '', flagOf: n => w.flagOf.get(n),
        field: o => w.field.get(o) ?? '', fieldOf: n => w.fieldOf.get(n),
    };
}

// ── enum constants: one name per value, kept only where the name reads back to it ──
const enums = new Map<string, { name: Map<number, string>; value: Map<string, number> } | null>();
function enumOf(type: string | undefined) {
    if (!type) return null;
    if (enums.has(type)) return enums.get(type)!;
    const own = ownEnum(type);
    if (own?.flags) { enums.set(type, null); return null; }
    const pairs: [string, number][] = [];
    for (const c of COMPILER[own?.base ?? type] ?? []) { const v = Number(c.value); if (Number.isFinite(v)) pairs.push([constantName(own?.base ?? type, v) === c.name ? c.name : '', v]); }
    for (const [v, n] of own?.values ?? []) pairs.push([n, v]);
    const value = new Map<string, number>(), seen = new Map<string, number>();
    for (const [n, v] of pairs) if (n && /^[A-Za-z_][A-Za-z0-9_]*$/.test(n)) seen.set(n, seen.has(n) && seen.get(n) !== v ? NaN : v);
    for (const [n, v] of seen) if (!Number.isNaN(v)) value.set(n, v);
    const name = new Map<number, string>();
    for (const [n, v] of value) if (!name.has(v)) name.set(v, n);
    const e = { name, value };
    enums.set(type, e);
    return e;
}

/** A value's name: its kind's resource, or its enum's constant; undefined when it has none. */
function valueName(v: number, p: Param | undefined, refs: Refs): string | undefined {
    const k = kindOf(p);
    if (k) return v % k.scale === 0 && (k.below === undefined || v < k.below) ? refs.name(k.kind, v / k.scale) : undefined;
    return enumOf(p?.enum)?.name.get(v);
}
/** A name → the value, or undefined. */
function valueOf(name: string, p: Param | undefined, refs: Refs): number | undefined {
    const k = kindOf(p);
    if (k) { const id = refs.id(k.kind, name); return id === undefined ? undefined : id * k.scale; }
    return enumOf(p?.enum)?.value.get(name);
}

const hex2 = (b: number) => b.toString(16).padStart(2, '0');
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
/** Splits `a, (b, c), d` at its top-level commas. */
export function splitTop(s: string): string[] {
    const out: string[] = [];
    let depth = 0, from = 0, cell = false;
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        // `<0x2260, 0x10>` is a cell; any other < or > compares.
        if (c === '<' && s.startsWith('0x', i + 1)) cell = true;
        else if (c === '>' && cell) cell = false;
        else if (c === '(' || c === '[') depth++;
        else if (c === ')' || c === ']') depth--;
        else if (c === ',' && depth === 0 && !cell) { out.push(s.slice(from, i).trim()); from = i + 1; }
    }
    out.push(s.slice(from).trim());
    return out.filter((x, i, a) => x || a.length > 1);
}

/** The bytes of one operand's text, for operand token `token`; throws an Error saying what is wrong. */
export function operandBytes(token: string, text: string, p: Param | undefined, refs: Refs, names: ExprNames): number[] {
    const raw = /^\[([0-9a-fA-F]{2}(?:\s+[0-9a-fA-F]{2})*)?\]$/.exec(text);
    if (raw) return (raw[1] ?? '').split(/\s+/).filter(Boolean).map(b => parseInt(b, 16));
    if (token === 'u8' || token === 'u16' || token === 'skip') {
        const size = token === 'u16' ? 2 : 1, max = size === 2 ? 0xFFFF : 0xFF, w = wramOf(p);
        const v = w && !/^(0x[0-9a-fA-F]+|\d+)$/.test(text) ? cellValue(text, w.area, w.flag, names) : NAME.test(text) ? valueOf(text, p, refs) : /^(0x[0-9a-fA-F]+|\d+)$/.test(text) ? Number(text) : undefined;
        if (v === undefined) throw new Error(NAME.test(text) ? `"${text}" names nothing ${p?.type ?? ''} ${p?.enum ?? ''} takes`.replace(/\s+/g, ' ') : `"${text}": a number 0-${max}, a name or [bytes]`);
        if (v < 0 || v > max) throw new Error(`${text} does not fit ${size === 2 ? 'a word' : 'a byte'}`);
        return size === 2 ? [v & 0xFF, v >> 8] : [v];
    }
    if (token === 'E') {
        if (NAME.test(text)) { const v = valueOf(text, p, refs); if (v !== undefined) return constBytes(v)!; }
        return exprBytes(text, names);
    }
    if (token === 'A' || token === 'Z') {
        const m = /^\((.*)\)$/s.exec(text);
        if (!m) throw new Error(`a list (a, b, …) of expressions`);
        const list = splitTop(m[1]).map(e => exprBytes(e, names));
        if (token === 'A' && (!list.length || list.length > 0xFF)) throw new Error('1-255 arguments');
        return [...(token === 'A' ? [list.length] : []), ...list.flat()];
    }
    throw new Error(`a ${token} operand is written as [bytes]`);
}

/** One operand's text from its bytes: the readable form when it reads back to the same bytes, else [bytes]. */
export function operandText(token: string, bytes: number[], parts: number[][] | null, p: Param | undefined, refs: Refs, names: ExprNames): string {
    const fallback = `[${bytes.map(hex2).join(' ')}]`;
    let text: string | null = null;
    const w = wramOf(p);
    if ((token === 'u8' || token === 'u16') && w) text = cellText(w.area, w.flag, token === 'u16' ? bytes[0] | (bytes[1] << 8) : bytes[0], names);
    else if (token === 'u8' || token === 'skip') text = valueName(bytes[0], p, refs) ?? (p?.hex ? '0x' + hex2(bytes[0]) : String(bytes[0]));
    else if (token === 'u16') { const v = bytes[0] | (bytes[1] << 8); text = valueName(v, p, refs) ?? (p?.hex ? '0x' + v.toString(16).padStart(4, '0') : String(v)); }
    else if (token === 'E') { const c = shortConst(bytes); text = (c !== undefined ? valueName(c, p, refs) : undefined) ?? exprText(bytes, names); }
    else if ((token === 'A' || token === 'Z') && parts) { const list = parts.map(e => exprText(e, names)); text = list.every(x => x !== null) ? `(${list.join(', ')})` : null; }
    if (text === null) return fallback;
    try {
        const back = operandBytes(token, text, p, refs, names);
        return back.length === bytes.length && back.every((b, i) => b === bytes[i]) ? text : fallback;
    } catch { return fallback; }
}
