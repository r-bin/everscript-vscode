// Script expressions as text for the scripts kind (docs/open-evermore/resources.md §scripts): the bytes $8C:EA43
// evaluates, written in infix with names, and read back to the same bytes. The notation is the Scripts tab's
// (script-vm/print.ts): `<0x2391>` a save-area word, `(Byte)` a byte read, `signed` a sign-extended one, `temp[n]` /
// `arg[n]` the temp area and the slot's local bytes, `<0x2260, 0x10>` a flag, `boy.x` an entity's field. On top of
// it, what makes the text exact: a constant not in its shortest form says so (`5:byte`, `300:word`), a read the area
// rule would not pick says which (`save:` / `temp:`), unary minus is `-(x)`. Names: WRAM cells and flags as the
// Scripts tab names them (script-model/names.ts), entities by their entities/ names.
//
// Facts (docs/scripts/vm.md §Expressions, script-vm/spec.ts SUB_OPS): each byte's low 7 bits pick a sub-op, bit 7
// marks the last; operands are postfix, `push` ($29) saves the current value for the next binary operator. Save
// area reads are $2258 + a word offset, temp area $2834 + a word offset, local reads the slot's bytes; a flag is a
// bit number (byte = number >> 3, mask = 1 << (number & 7)).
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { SUB_OPS } = require('../../../../dist/games/evermore/script-vm/spec');

const SAVE = 0x2258, TEMP = 0x2834, TEMP_SIZE = 200;
type Area = 'save' | 'temp' | 'local';
const BASE: Record<string, number> = { save: SAVE, temp: TEMP };
/** The area a cell is read from unless the text says otherwise: the temp area's 200 bytes, else the save area. */
const areaOf = (addr: number): Area => addr >= TEMP && addr < TEMP + TEMP_SIZE ? 'temp' : 'save';

/** Names an expression is written with; each lookup is '' / undefined when there is none. */
export interface ExprNames {
    entity(subOp: number): string | undefined;
    entityOf(name: string): number | undefined;
    memory(addr: number): string;
    memoryOf(name: string): number | undefined;
    flag(addr: number, mask: number): string;
    flagOf(name: string): { addr: number; mask: number } | undefined;
    field(offset: number): string;
    fieldOf(name: string): number | undefined;
    /** A named value of the cell at `addr` (absolute): what `CELL == NAME` compares with. */
    value?(addr: number, v: number): string;
    valueOf?(addr: number, name: string): number | undefined;
    /** A cell at `addr` (absolute) written as a number (`<0x2391>`): it does not follow its variable if that moves. */
    numbered?(addr: number): void;
}

interface Term { op: number; imm?: number; size: 0 | 1 | 2 }
type Node = { k: 'leaf'; t: Term } | { k: 'un'; t: Term; arg: Node } | { k: 'bin'; t: Term; left: Node; right: Node };

const spec = (op: number) => SUB_OPS.get(op) as { kind: string; size: 0 | 1 | 2; name: string; area?: Area; width?: 1 | 2; signed?: boolean } | undefined;
const hex = (v: number, w = 2) => '0x' + v.toString(16).padStart(w, '0');

/** An expression's terms; null when a byte is no sub-op or an end ($00) stands inside. */
function terms(bytes: number[]): Term[] | null {
    const out: Term[] = [];
    for (let p = 0; p < bytes.length;) {
        const op = bytes[p] & 0x7F, s = spec(op);
        if (!s || op === 0x00) return null;
        const t: Term = { op, size: s.size };
        if (s.size === 1) t.imm = bytes[p + 1];
        if (s.size === 2) t.imm = bytes[p + 1] | (bytes[p + 2] << 8);
        out.push(t);
        p += 1 + s.size;
        if (((bytes[p - 1 - s.size] & 0x80) !== 0) !== (p === bytes.length)) return null;
    }
    return out.length ? out : null;
}

/** The tree of the terms, when the postfix order is the plain one (a value, then unary operators, a push before
 *  each binary operator's right side); null otherwise. */
function treeOf(ts: Term[]): Node | null {
    const stack: (Node | null)[] = [];
    let cur: Node | null = null;
    for (const t of ts) {
        const k = spec(t.op)!.kind;
        if (k === 'push') { if (!cur) return null; stack.push(cur); cur = null; continue; }
        if (k === 'unary') { if (!cur) return null; cur = { k: 'un', t, arg: cur }; continue; }
        if (k === 'binary') { const left = stack.pop(); if (!left || !cur) return null; cur = { k: 'bin', t, left, right: cur }; continue; }
        if (cur) return null;
        cur = { k: 'leaf', t };
    }
    return stack.length ? null : cur;
}

function postfix(n: Node): Term[] {
    if (n.k === 'leaf') return [n.t];
    if (n.k === 'un') return [...postfix(n.arg), n.t];
    return [...postfix(n.left), { op: 0x29, size: 0 }, ...postfix(n.right), n.t];
}

function encode(ts: Term[]): number[] {
    const out: number[] = [];
    ts.forEach((t, i) => {
        out.push(t.op | (i === ts.length - 1 ? 0x80 : 0));
        if (t.size === 1) out.push(t.imm! & 0xFF);
        if (t.size === 2) out.push(t.imm! & 0xFF, (t.imm! >> 8) & 0xFF);
    });
    return out;
}

// ── constants ──
/** The value of a constant term. */
function constValue(t: Term): number {
    if (t.op >= 0x30 && t.op <= 0x3F) return t.op - 0x30;
    if (t.op >= 0x40 && t.op <= 0x4F) return t.op - 0x50;
    if (t.op >= 0x60 && t.op <= 0x6F) return t.op - 0x50;
    if (t.op === 0x01) return (t.imm! | 0xFF00) - 0x10000;
    if (t.op === 0x03) return t.imm! - 0x10000;
    return t.imm!;
}
/** A constant in its shortest form, or in the form `size` asks for; null when it does not fit. */
export function constTerm(v: number, size?: 'byte' | 'word'): Term | null {
    if (!size && v >= -16 && v < 32) return { op: v < 0 ? 0x50 + v : v < 16 ? 0x30 + v : 0x50 + v, size: 0 };
    if (size !== 'word' && v >= 0 && v < 0x100) return { op: 0x02, imm: v, size: 1 };
    if (size !== 'word' && v < 0 && v >= -0x100) return { op: 0x01, imm: v & 0xFF, size: 1 };
    if (size === 'byte') return null;
    if (v >= 0 && v < 0x10000) return { op: 0x04, imm: v, size: 2 };
    if (v < 0 && v >= -0x10000) return { op: 0x03, imm: v + 0x10000, size: 2 };
    return null;
}
/** A constant expression's bytes in its shortest form (a lone name stands for one). */
export const constBytes = (v: number): number[] | null => { const t = constTerm(v); return t ? encode([t]) : null; };
/** The value of an expression that is one constant in its shortest form; undefined otherwise. */
export function shortConst(bytes: number[]): number | undefined {
    const ts = terms(bytes);
    if (!ts || ts.length !== 1 || spec(ts[0].op)!.kind !== 'const') return undefined;
    const v = constValue(ts[0]), short = constTerm(v);
    return short && short.op === ts[0].op ? v : undefined;
}
/** Numbers in decimal: a constant is a value (cells, masks and ids are hex). */
const numText = (v: number) => String(v);

// ── printing ──
const PREC: Record<string, number> = { '||': 1, '&&': 2, '|': 3, '^': 4, '&': 5, '==': 6, '!=': 6, '<': 7, '>': 7, '<=': 7, '>=': 7, '<<': 8, '>>': 8, '+': 9, '-': 9, '*': 10, '/': 10 };

function leafText(t: Term, names: ExprNames): string {
    const s = spec(t.op)!, v = t.imm ?? 0;
    if (s.kind === 'const') {
        const value = constValue(t), short = constTerm(value);
        return numText(value) + (short && short.op === t.op ? '' : t.size === 1 ? ':byte' : ':word');
    }
    if (s.kind === 'value') return names.entity(t.op) ?? `${s.name}()`;
    if (s.kind === 'flag') {
        if (s.area === 'local') return `arg_flag[${v >> 3}, ${hex(1 << (v & 7))}]`;
        const addr = BASE[s.area!] + (v >> 3), mask = 1 << (v & 7), named = names.flag(addr, mask);
        const cell = named || (s.area === 'temp' && areaOf(addr) === 'temp' ? `temp_flag[${addr - TEMP}, ${hex(mask)}]` : `<${hex(addr, 4)}, ${hex(mask)}>`);
        return (areaOf(addr) === s.area ? '' : `${s.area}:`) + cell;
    }
    // A read.
    const prefix = (s.signed ? 'signed ' : '') + (s.width === 1 ? '(Byte)' : '');
    if (s.area === 'local') return `${prefix}arg[${v}]`;
    const addr = BASE[s.area!] + v, named = names.memory(addr);
    const cell = named || (s.area === 'temp' && areaOf(addr) === 'temp' ? `temp[${addr - TEMP}]` : `<${hex(addr, 4)}>`);
    return prefix + (areaOf(addr) === s.area ? '' : `${s.area}:`) + cell;
}

/** `boy.x` for deref(entity + offset) (`(Byte)` for deref_byte), the offset a shortest constant; '' otherwise. */
function fieldText(n: Node, names: ExprNames): string {
    if (n.k !== 'un') return '';
    const op = spec(n.t.op)!.name;
    if (op !== 'deref' && op !== 'deref_byte') return '';
    const a = n.arg;
    let base: Node = a, offset = 0;
    if (a.k === 'bin' && spec(a.t.op)!.name === '+' && a.right.k === 'leaf' && spec(a.right.t.op)!.kind === 'const') {
        const v = constValue(a.right.t), short = constTerm(v);
        if (!short || short.op !== a.right.t.op || v <= 0) return '';
        base = a.left; offset = v;
    }
    if (base.k !== 'leaf' || spec(base.t.op)!.kind !== 'value') return '';
    const entity = names.entity(base.t.op), field = names.field(offset);
    return entity && field ? (op === 'deref_byte' ? '(Byte)' : '') + `${entity}.${field}` : '';
}

function nodeText(n: Node, names: ExprNames, outer = 0): string {
    if (n.k === 'leaf') return leafText(n.t, names);
    if (n.k === 'un') {
        const f = fieldText(n, names);
        if (f) return f;
        const op = spec(n.t.op)!.name;
        if (op === '!' || op === '~') return op + nodeText(n.arg, names, 11);
        return `${op === '-' ? '-' : op}(${nodeText(n.arg, names)})`;
    }
    const op = spec(n.t.op)!.name, p = PREC[op];
    // A cell compared with a constant its values name: `PRIZE == WAX`.
    const cell = (op === '==' || op === '!=') ? readCell(n.left) : undefined;
    const named = cell !== undefined && n.right.k === 'leaf' && spec(n.right.t.op)!.kind === 'const' && constTerm(constValue(n.right.t))?.op === n.right.t.op ? names.value?.(cell, constValue(n.right.t)) : '';
    const s = `${nodeText(n.left, names, p)} ${op} ${named || nodeText(n.right, names, p + 1)}`;
    return p < outer ? `(${s})` : s;
}

/** The absolute address a save- or temp-area read leaf reads; undefined for anything else. */
function readCell(n: Node): number | undefined {
    if (n.k !== 'leaf') return undefined;
    const s = spec(n.t.op)!;
    return s.kind === 'read' && s.area !== 'local' ? BASE[s.area!] + (n.t.imm ?? 0) : undefined;
}

/** An expression's bytes as text; null when they are not in the plain postfix order (write them as hex). */
export function exprText(bytes: number[], names: ExprNames): string | null {
    const ts = terms(bytes), tree = ts && treeOf(ts);
    return tree ? nodeText(tree, names) : null;
}

// ── reading ──
const TOKEN = /\s*(\(Byte\)|<0x[0-9a-fA-F]+(?:,\s*0x[0-9a-fA-F]+)?>|(?:save|temp):|\|\||&&|==|!=|<=|>=|<<|>>|[-+*/&|^<>!~(),\[\]]|0x[0-9a-fA-F]+(?::byte|:word)?|\d+(?::byte|:word)?|[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?)/y;
const VALUE_FNS = new Map<string, number>(), UNARY_FNS = new Map<string, number>(), BINARY = new Map<string, number>(), UNARY_OPS = new Map<string, number>();
for (const [op, s] of SUB_OPS as Map<number, { kind: string; name: string }>) {
    if (s.kind === 'value') VALUE_FNS.set(s.name, op);
    if (s.kind === 'unary') (['!', '~', '-'].includes(s.name) ? UNARY_OPS : UNARY_FNS).set(s.name, op);
    if (s.kind === 'binary') BINARY.set(s.name, op);
}
const READ_OP: Record<Area, Record<string, number>> = {
    save: { b: 0x07, sb: 0x06, w: 0x09, sw: 0x08 }, temp: { b: 0x0C, sb: 0x0B, w: 0x0E, sw: 0x0D }, local: { b: 0x11, sb: 0x10, w: 0x13, sw: 0x12 },
};
const FLAG_OP: Record<Area, number> = { save: 0x05, temp: 0x0A, local: 0x0F };

/** An expression's text → its bytes; throws an Error saying what is wrong. */
export function exprBytes(text: string, names: ExprNames): number[] {
    const toks: string[] = [], end = text.trimEnd().length;
    for (let at = 0; at < end;) {
        TOKEN.lastIndex = at;
        const m = TOKEN.exec(text);
        if (!m) throw new Error(`cannot read "${text.slice(at).trim()}"`);
        toks.push(m[1]); at = TOKEN.lastIndex;
    }
    let i = 0, valueCell: number | undefined;
    const peek = () => toks[i], next = () => toks[i++], expect = (t: string) => { if (toks[i++] !== t) throw new Error(`"${t}" expected`); };
    const num = (t: string | undefined): number => { if (t === undefined || !/^(0x[0-9a-f]+|\d+)$/i.test(t)) throw new Error(`a number expected, not "${t}"`); return Number(t); };
    const leaf = (t: Term): Node => ({ k: 'leaf', t });
    const read = (area: Area, offset: number, width: 'b' | 'w', signed: boolean): Node => {
        const max = area === 'local' ? 0xFF : 0xFFFF;
        if (offset < 0 || offset > max) throw new Error(`the cell is out of the ${area} area's reach`);
        return leaf({ op: READ_OP[area][(signed ? 's' : '') + width], imm: offset, size: area === 'local' ? 1 : 2 });
    };
    const flag = (area: Area, byte: number, mask: number): Node => {
        const bit = Math.log2(mask), n = byte * 8 + bit;
        if (!Number.isInteger(bit) || bit > 7 || n < 0 || n > (area === 'local' ? 0xFF : 0xFFFF)) throw new Error(`no flag of the ${area} area`);
        return leaf({ op: FLAG_OP[area], imm: n, size: area === 'local' ? 1 : 2 });
    };
    const primary = (): Node => {
        let signed = false, width: 'b' | 'w' = 'w', area: Area | undefined;
        if (peek() === 'signed') { next(); signed = true; }
        if (peek() === '(Byte)') { next(); width = 'b'; }
        if (peek() === 'save:' || peek() === 'temp:') area = next()!.slice(0, -1) as Area;
        const t = next();
        if (t === undefined) throw new Error('the expression ends too soon');
        const plain = !signed && width === 'w' && !area;
        if (t === '(' && plain) { const e = expr(0); expect(')'); return e; }
        const n = /^(0x[0-9a-f]+|\d+)(?::(byte|word))?$/i.exec(t);
        if (n && plain) { const c = constTerm(Number(n[1]), n[2] as 'byte' | 'word' | undefined); if (!c) throw new Error(`${t} does not fit`); return leaf(c); }
        const cell = /^<(0x[0-9a-f]+)(?:,\s*(0x[0-9a-f]+))?>$/i.exec(t);
        if (cell) {
            const addr = Number(cell[1]), a = area ?? areaOf(addr);
            names.numbered?.(addr);
            if (cell[2] !== undefined) { if (signed || width === 'b') throw new Error('a flag has no width'); return flag(a, addr - BASE[a], Number(cell[2])); }
            return read(a, addr - BASE[a], width, signed);
        }
        if ((t === 'temp' || t === 'arg' || t === 'temp_flag' || t === 'arg_flag') && peek() === '[') {
            next();
            const k = num(next());
            if (t.endsWith('_flag')) { expect(','); const m = num(next()); expect(']'); return flag(t === 'arg_flag' ? 'local' : 'temp', k, m); }
            expect(']');
            return read(t === 'arg' ? 'local' : 'temp', k, width, signed);
        }
        if (/^[A-Za-z_]/.test(t) && peek() === '(' && plain) {
            next();
            if (VALUE_FNS.has(t)) { expect(')'); return leaf({ op: VALUE_FNS.get(t)!, size: 0 }); }
            const op = UNARY_FNS.get(t);
            if (op === undefined) throw new Error(`"${t}" is no function of an expression`);
            const arg = expr(0); expect(')');
            return { k: 'un', t: { op, size: 0 }, arg };
        }
        if (/^[A-Za-z_]/.test(t)) {
            const dot = t.indexOf('.');
            if (dot > 0 && !signed && !area) {
                const e = names.entityOf(t.slice(0, dot)), f = names.fieldOf(t.slice(dot + 1));
                if (e === undefined || f === undefined) throw new Error(`"${t}" is no entity's field`);
                const base = leaf({ op: e, size: 0 }), arg: Node = f ? { k: 'bin', t: { op: 0x1A, size: 0 }, left: base, right: leaf(constTerm(f)!) } : base;
                return { k: 'un', t: { op: width === 'b' ? 0x56 : 0x55, size: 0 }, arg };
            }
            const value = valueCell !== undefined && plain ? names.valueOf?.(valueCell, t) : undefined;
            if (value !== undefined) { const c = constTerm(value); if (c) return leaf(c); }
            const e = names.entityOf(t), fl = names.flagOf(t), mem = names.memoryOf(t);
            if ([e, fl, mem].filter(x => x !== undefined).length > 1) throw new Error(`"${t}" names more than one thing`);
            if (e !== undefined && plain) return leaf({ op: e, size: 0 });
            if (fl && !signed && width === 'w') { const a = area ?? areaOf(fl.addr); return flag(a, fl.addr - BASE[a], fl.mask); }
            if (mem !== undefined) { const a = area ?? areaOf(mem); return read(a, mem - BASE[a], width, signed); }
            throw new Error(`"${t}" is no entity, flag or WRAM cell`);
        }
        throw new Error(`"${t}" cannot start a value`);
    };
    const unary = (): Node => {
        const t = peek();
        if (t === '!' || t === '~') { next(); return { k: 'un', t: { op: UNARY_OPS.get(t)!, size: 0 }, arg: unary() }; }
        if (t === '-') {
            next();
            // `-5` a negative constant, `-(x)` negation.
            if (peek() !== '(' ) { const n = /^(0x[0-9a-f]+|\d+)(?::(byte|word))?$/i.exec(next() ?? ''); if (!n) throw new Error('`-` takes a number or (x)'); const c = constTerm(-Number(n[1]), n[2] as 'byte' | 'word' | undefined); if (!c) throw new Error(`-${n[1]} does not fit`); return leaf(c); }
            next(); const arg = expr(0); expect(')');
            return { k: 'un', t: { op: UNARY_OPS.get('-')!, size: 0 }, arg };
        }
        return primary();
    };
    const expr = (min: number): Node => {
        let left = unary();
        for (;;) {
            const t = peek(), p = t === undefined ? undefined : PREC[t];
            if (p === undefined || p < min) return left;
            next();
            const outer = valueCell;
            valueCell = t === '==' || t === '!=' ? readCell(left) : undefined;
            const right = expr(p + 1);
            valueCell = outer;
            left = { k: 'bin', t: { op: BINARY.get(t!)!, size: 0 }, left, right };
        }
    };
    const tree = expr(0);
    if (i < toks.length) throw new Error(`"${toks[i]}" after the expression`);
    return encode(postfix(tree));
}

// ── a command's own cell or flag operand (write_word's cell, set_flag's bit): written as an expression would name it ──
const CELL_READ: Record<Area, number> = { save: 0x09, temp: 0x0E, local: 0x13 };
/** The text for an area's cell (a word offset) or flag (a bit number). */
export function cellText(area: Area, flag: boolean, value: number, names: ExprNames): string {
    return leafText({ op: flag ? FLAG_OP[area] : CELL_READ[area], imm: value, size: area === 'local' ? 1 : 2 }, names);
}
/** A cell's or flag's text → its offset or bit number in `area`; throws when it is not one of that area's. */
export function cellValue(text: string, area: Area, flag: boolean, names: ExprNames): number {
    const b = exprBytes(text, names), want = (flag ? FLAG_OP[area] : CELL_READ[area]) | 0x80;
    if (b[0] !== want || b.length !== (area === 'local' ? 2 : 3)) throw new Error(`"${text}" is no ${flag ? 'flag' : 'cell'} of the ${area} area`);
    return area === 'local' ? b[1] : b[1] | (b[2] << 8);
}
export type { Area };
