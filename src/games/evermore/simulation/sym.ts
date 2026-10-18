// Ownership: symbolic values — what a script computes when part of the game
// state is unknown. Pure.
//
// A value is either a concrete 16-bit number or an expression over things the
// simulation cannot know: the save file's contents (`mem`), the player's
// choices and the clock (`atom`), and entities placed while the script runs
// (`ent`). Every constructor simplifies, so a value that *can* be known is
// always a plain `c` — that is what lets a fork be decided instead of taken.
import { hexLower } from '../../../platform/hex';

export type Sym =
    | { k: 'c'; v: number }
    /** The value a WRAM byte or word had before the simulation touched it. */
    | { k: 'mem'; addr: number; size: 1 | 2 }
    /** Something outside WRAM: random draw, timer, dialog choice, script argument. */
    | { k: 'atom'; name: string; volatile: boolean }
    /** An entity: boy, dog, or one the script placed. */
    | { k: 'ent'; id: number; label: string }
    | { k: 'un'; op: string; a: Sym }
    | { k: 'bin'; op: string; a: Sym; b: Sym }
    /** Bit `bit` of a byte, as 0/1. */
    | { k: 'bit'; a: Sym; bit: number }
    /** A byte with one bit replaced. */
    | { k: 'setbit'; a: Sym; bit: number; v: Sym }
    | { k: 'lo'; a: Sym }
    | { k: 'hi'; a: Sym }
    | { k: 'word'; lo: Sym; hi: Sym }
    /** `a` where `cond` held, `b` where it did not: two merged paths disagreeing. */
    | { k: 'ite'; cond: Sym; a: Sym; b: Sym };

export const c = (v: number): Sym => ({ k: 'c', v: v & 0xffff });

/** Past this many nodes a value is not worth tracking: it becomes one opaque unknown. */
const MAX_NODES = 400;
const SIZES = new WeakMap<Sym, number>();
function size(s: Sym): number {
    let n = SIZES.get(s);
    if (n !== undefined) return n;
    switch (s.k) {
        case 'un': case 'bit': case 'lo': case 'hi': n = 1 + size(s.a); break;
        case 'bin': n = 1 + size(s.a) + size(s.b); break;
        case 'setbit': n = 1 + size(s.a) + size(s.v); break;
        case 'word': n = 1 + size(s.lo) + size(s.hi); break;
        case 'ite': n = 1 + size(s.cond) + size(s.a) + size(s.b); break;
        default: n = 1;
    }
    SIZES.set(s, Math.min(n, 1e9));
    return n;
}
/** Keep a freshly built value, or stand in for it when it has grown too large. */
function bounded(s: Sym): Sym {
    return size(s) > MAX_NODES ? { k: 'atom', name: `complex value #${consId(s)}`, volatile: false } : s;
}
export const isC = (s: Sym): s is { k: 'c'; v: number } => s.k === 'c';
export const TRUE = c(1);
export const FALSE = c(0);

const s16 = (v: number): number => (v & 0x8000 ? (v & 0xffff) - 0x10000 : v & 0xffff);

/** Constant folding for the operators the operand grammar has. */
function fold(op: string, a: number, b: number): number | null {
    switch (op) {
        case '*': return a * b;
        case '/': return b === 0 ? null : Math.trunc(s16(a) / s16(b));
        case '+': return a + b;
        case '-': return a - b;
        case '<<': return a << (b & 15);
        case '>>': return a >>> (b & 15);
        case '<': return s16(a) < s16(b) ? 1 : 0;
        case '>': return s16(a) > s16(b) ? 1 : 0;
        case '<=': return s16(a) <= s16(b) ? 1 : 0;
        case '>=': return s16(a) >= s16(b) ? 1 : 0;
        case '==': return (a & 0xffff) === (b & 0xffff) ? 1 : 0;
        case '!=': return (a & 0xffff) !== (b & 0xffff) ? 1 : 0;
        case '&': return a & b;
        case '|': return a | b;
        case '^': return a ^ b;
        case '||': return a || b ? 1 : 0;
        case '&&': return a && b ? 1 : 0;
        default: return null;
    }
}

/**
 * Memoised unary transforms. Merged values share sub-trees; pushing `lo`,
 * `bit` or `truthy` through them without a memo revisits every shared node
 * once per path to it, which is exponential in the number of merges.
 */
const MEMO = new Map<string, WeakMap<Sym, unknown>>();
function memo<T>(tag: string, s: Sym, f: () => T): T {
    let m = MEMO.get(tag);
    if (!m) { m = new WeakMap(); MEMO.set(tag, m); }
    if (m.has(s)) return m.get(s) as T;
    const v = f();
    m.set(s, v);
    return v;
}

/** True when the value can only be 0..255. */
function isByte(s: Sym): boolean {
    return memo('isByte', s, () => isByteRaw(s));
}
function isByteRaw(s: Sym): boolean {
    if (s.k === 'ite') return isByte(s.a) && isByte(s.b);
    return (s.k === 'mem' && s.size === 1) || s.k === 'lo' || s.k === 'hi' || s.k === 'setbit' ||
        (s.k === 'c' && s.v < 0x100) || s.k === 'bit';
}

export function bin(op: string, a: Sym, b: Sym): Sym {
    // Push an operation into a merged value while its arms stay constant.
    if (a.k === 'ite' && isC(b) && isC(a.a) && isC(a.b)) return ite(a.cond, bin(op, a.a, b), bin(op, a.b, b));
    if (b.k === 'ite' && isC(a) && isC(b.a) && isC(b.b)) return ite(b.cond, bin(op, a, b.a), bin(op, a, b.b));
    if (isC(a) && isC(b)) {
        const v = fold(op, a.v, b.v);
        if (v !== null) return c(v);
    }
    if (op === '&' && isC(b) && b.v === 0xff && isByte(a)) return a;
    if (op === '&' && isC(b) && b.v === 0xff && a.k === 'word') return a.lo;
    if (op === '+' && isC(b) && b.v === 0) return a;
    if (op === '+' && isC(a) && !isC(b)) return bin('+', b, a);
    // (x + c1) + c2 -> x + (c1 + c2): keeps "count + 3" readable.
    if (op === '+' && isC(b) && a.k === 'bin' && a.op === '+' && isC(a.b)) return bin('+', a.a, c(a.b.v + b.v));
    if ((op === '&&' || op === '||') && isC(a)) {
        if (op === '&&') return a.v ? truthy(b) : FALSE;
        return a.v ? TRUE : truthy(b);
    }
    // (x + k) == n  ->  x == n - k, so facts about x line up whatever offset tested them.
    if ((op === '==' || op === '!=') && isC(b) && a.k === 'bin' && a.op === '+' && isC(a.b)) return bin(op, a.a, c(b.v - a.b.v));
    if ((op === '==' || op === '!=') && a.k === 'bit' && isC(b) && (b.v === 0 || b.v === 1)) {
        return (op === '==') === (b.v === 1) ? a : not(a);
    }
    return bounded({ k: 'bin', op, a, b });
}

/** A condition normalised to 0/1 where that is possible. */
export function truthy(s: Sym): Sym {
    return isC(s) ? (s.v ? TRUE : FALSE) : memo('truthy', s, () => truthyRaw(s));
}
function truthyRaw(s: Sym): Sym {
    if (s.k === 'ite') return ite(s.cond, truthy(s.a), truthy(s.b));
    if (s.k === 'bit' || isComparison(s)) return s;
    return bin('!=', s, FALSE);
}

const COMPARISONS = new Set(['<', '>', '<=', '>=', '==', '!=', '&&', '||']);
function isComparison(s: Sym): boolean {
    return (s.k === 'bin' && COMPARISONS.has(s.op)) || (s.k === 'un' && s.op === '!');
}

const NEGATE: Record<string, string> = { '<': '>=', '>=': '<', '>': '<=', '<=': '>', '==': '!=', '!=': '==' };

export function not(a: Sym): Sym {
    if (isC(a)) return a.v ? FALSE : TRUE;
    if (a.k === 'un' && a.op === '!') return truthy(a.a);
    if (a.k === 'bin' && NEGATE[a.op]) return { k: 'bin', op: NEGATE[a.op], a: a.a, b: a.b };
    return { k: 'un', op: '!', a };
}

export function un(op: string, a: Sym): Sym {
    if (op === '!') return not(a);
    if (isC(a)) return c(op === '~' ? ~a.v : -a.v);
    return { k: 'un', op, a };
}

export function bit(a: Sym, n: number): Sym {
    return isC(a) ? c((a.v >> n) & 1) : memo(`bit${n}`, a, () => bitRaw(a, n));
}
function bitRaw(a: Sym, n: number): Sym {
    if (a.k === 'ite') return ite(a.cond, bit(a.a, n), bit(a.b, n));
    if (a.k === 'setbit') return a.bit === n ? truthy(a.v) : bit(a.a, n);
    return { k: 'bit', a, bit: n };
}

export function setbit(a: Sym, n: number, v: Sym): Sym {
    const t = truthy(v);
    if (isC(a) && isC(t)) return c(t.v ? a.v | (1 << n) : a.v & ~(1 << n) & 0xff);
    // Replacing a bit twice keeps only the last write.
    if (a.k === 'setbit' && a.bit === n) return setbit(a.a, n, t);
    return bounded({ k: 'setbit', a, bit: n, v: t });
}

/**
 * A merged value. Collapses when both arms agree, and a 0/1 choice is just
 * the condition itself — so a later test of the merged value forks on the
 * flag that caused it, not on an opaque blend.
 */
export function ite(cond: Sym, a: Sym, b: Sym): Sym {
    const t = truthy(cond);
    if (isC(t)) return t.v ? a : b;
    if (key(a) === key(b)) return a;
    if (isC(a) && isC(b) && a.v === 1 && b.v === 0) return t;
    if (isC(a) && isC(b) && a.v === 0 && b.v === 1) return not(t);
    return bounded({ k: 'ite', cond: t, a, b });
}

export function lo(a: Sym): Sym {
    return isC(a) ? c(a.v & 0xff) : memo('lo', a, () => loRaw(a));
}
function loRaw(a: Sym): Sym {
    if (a.k === 'ite') return ite(a.cond, lo(a.a), lo(a.b));
    if (a.k === 'word') return a.lo;
    if (isByte(a)) return a;
    return { k: 'lo', a };
}

export function hi(a: Sym): Sym {
    return isC(a) ? c((a.v >> 8) & 0xff) : memo('hi', a, () => hiRaw(a));
}
function hiRaw(a: Sym): Sym {
    if (a.k === 'ite') return ite(a.cond, hi(a.a), hi(a.b));
    if (a.k === 'word') return a.hi;
    if (isByte(a)) return FALSE;
    return { k: 'hi', a };
}

export function word(l: Sym, h: Sym): Sym {
    if (isC(l) && isC(h)) return c(l.v | (h.v << 8));
    if (l.k === 'lo' && h.k === 'hi' && same(l.a, h.a)) return l.a;
    if (l.k === 'mem' && h.k === 'mem' && l.size === 1 && h.size === 1 && h.addr === l.addr + 1) {
        return { k: 'mem', addr: l.addr, size: 2 };
    }
    if (isC(h) && h.v === 0 && isByte(l)) return l;
    if (l.k === 'ite' && h.k === 'ite' && key(l.cond) === key(h.cond)) return ite(l.cond, word(l.a, h.a), word(l.b, h.b));
    if (l.k === 'ite' && isC(h)) return ite(l.cond, word(l.a, h), word(l.b, h));
    return bounded({ k: 'word', lo: l, hi: h });
}

/** `s` with the given conditions (by key) replaced by what they are known to be. */
export function under(s: Sym, known: ReadonlyMap<string, boolean>): Sym {
    const k = key(s);
    if (known.has(k)) return known.get(k) ? TRUE : FALSE;
    if (s.k === 'un' && s.op === '!') return not(under(s.a, known));
    if (s.k === 'bin' && (s.op === '&&' || s.op === '||')) return bin(s.op, under(s.a, known), under(s.b, known));
    if (s.k === 'ite') return ite(under(s.cond, known), under(s.a, known), under(s.b, known));
    if (known.has(key(not(s)))) return known.get(key(not(s))) ? FALSE : TRUE;
    return s;
}

/** Structural identity, through the rendering. */
export function same(a: Sym, b: Sym): boolean {
    return key(a) === key(b);
}

const hex = (v: number, d = 4): string => '0x' + hexLower(v, d);
export const ramHex = (a: number): string => '$' + hexLower(a & 0xffff, 4);

const KEYS = new WeakMap<Sym, string>();

/**
 * A stable textual key, also used as the human rendering. Memoised per
 * value: merged values share sub-trees, and re-rendering a shared tree at
 * every use is exponential.
 */
export function key(s: Sym): string {
    let k = KEYS.get(s);
    if (k === undefined) {
        k = render(s);
        // Merged values can be large; past this the text is cut but stays unique.
        if (k.length > MAX_KEY) k = `${k.slice(0, 100)}…#${consId(s)}`;
        KEYS.set(s, k);
    }
    return k;
}

const MAX_KEY = 160;
const IDS = new WeakMap<Sym, number>();
const CONS = new Map<string, number>();

/** Hash-consed structural id: equal structures, equal ids — cheap even for shared trees. */
function consId(s: Sym): number {
    let n = IDS.get(s);
    if (n !== undefined) return n;
    let sig: string;
    switch (s.k) {
        case 'c': sig = `c${s.v}`; break;
        case 'mem': sig = `m${s.addr}.${s.size}`; break;
        case 'atom': sig = `a${s.name}`; break;
        case 'ent': sig = `e${s.id}`; break;
        case 'un': sig = `u${s.op}(${consId(s.a)})`; break;
        case 'bin': sig = `b${s.op}(${consId(s.a)},${consId(s.b)})`; break;
        case 'bit': sig = `t${s.bit}(${consId(s.a)})`; break;
        case 'setbit': sig = `s${s.bit}(${consId(s.a)},${consId(s.v)})`; break;
        case 'lo': sig = `l(${consId(s.a)})`; break;
        case 'hi': sig = `h(${consId(s.a)})`; break;
        case 'word': sig = `w(${consId(s.lo)},${consId(s.hi)})`; break;
        case 'ite': sig = `i(${consId(s.cond)},${consId(s.a)},${consId(s.b)})`; break;
    }
    n = CONS.get(sig);
    if (n === undefined) { n = CONS.size; CONS.set(sig, n); }
    IDS.set(s, n);
    return n;
}

function render(s: Sym): string {
    switch (s.k) {
        case 'c': return s.v < 10 ? String(s.v) : hex(s.v, s.v > 0xff ? 4 : 2);
        case 'mem': return s.size === 1 ? `${ramHex(s.addr)}.b` : ramHex(s.addr);
        case 'atom': return s.name;
        case 'ent': return s.label;
        case 'un': return `${s.op}(${key(s.a)})`;
        case 'bin': return `(${key(s.a)} ${s.op} ${key(s.b)})`;
        case 'bit': return s.a.k === 'mem' ? `${ramHex(s.a.addr)}&${hex(1 << s.bit, 2)}` : `bit${s.bit}(${key(s.a)})`;
        case 'setbit': return `${key(s.a)}{bit${s.bit}=${key(s.v)}}`;
        case 'lo': return `lo(${key(s.a)})`;
        case 'hi': return `hi(${key(s.a)})`;
        case 'word': return `word(${key(s.lo)}, ${key(s.hi)})`;
        case 'ite': return `(${key(s.cond)} ? ${key(s.a)} : ${key(s.b)})`;
    }
}

/** Every saved-state read a value depends on — the atoms a fork is "about". */
export function reads(s: Sym, out: Set<string> = new Set()): Set<string> {
    switch (s.k) {
        case 'mem': out.add(ramHex(s.addr)); break;
        case 'atom': out.add(s.name); break;
        case 'un': case 'bit': case 'lo': case 'hi': reads(s.a, out); break;
        case 'setbit': reads(s.a, out); reads(s.v, out); break;
        case 'bin': reads(s.a, out); reads(s.b, out); break;
        case 'word': reads(s.lo, out); reads(s.hi, out); break;
        case 'ite': reads(s.cond, out); reads(s.a, out); reads(s.b, out); break;
        default: break;
    }
    return out;
}

/** The entity a value names, if it names exactly one. */
export function entityOf(s: Sym): { id: number; label: string } | null {
    if (s.k === 'ent') return s;
    return null;
}
