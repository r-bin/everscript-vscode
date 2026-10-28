// Ownership: an instruction as one line of text in the Everscript compiler's notation — `<0x2391>`
// for a word, `<0x2260, 0x10>` for a flag, `arg[n]` for the slot's local bytes, `goto`, `call` —
// with our names for the opcodes (spec.ts) and the caller's names for memory, scripts and maps.
// An unnamed cell of the room's temp area ($2834, 200 bytes) reads `temp[n]`, like `arg[n]`;
// a caller that has sliced them (`Names.slice`) gets `arg.entity_1`, `temp.word_2`.
// Pure. This is for reading; `everscript()` gives the form that compiles back to the same bytes.
//
// `printed()` also says what is wrong with the line (`Mark`): an error for an opcode we have no
// name for, a warning for a `signed` read whose sign cannot change the result — only tested for
// zero, compared with a small constant, or passed where the handler takes an entity (a word).
//
// Each operand's type comes from parameters.json (estimated from the ROM's use, named from the
// handlers): an entity, an enum. Constants are named where the caller knows the enum
// (`Names.constant`), and a constant the enum does not have is a warning (`Names.inEnum`); so is a value written to
// or compared with a cell whose values are known (`Names.value`) — named when it can be. A called global reads by its name, `call_id(FADE_IN)`.
// `end` reads `return;`: it leaves the script, back to its caller or, at the top, the thread.

import { Instruction, Operand } from './decode';
import { Expression, Node, Term, tree } from './expression';
import { Fact, facts } from './facts';
import { Parameter, ownEnum, parameters } from './parameters';
import { hexLower } from '../../../platform/hex';

/** Names a caller can supply; each returns '' (or null) when it has none. */
export interface Names {
    /** A save- or temp-area address (absolute). */
    memory?(addr: number): string;
    /** A flag: address and bit mask. */
    flag?(addr: number, mask: number): string;
    /** A script by its bus address. */
    script?(bus: number): string;
    /** A global script by its id (0xA3, 0xB0). */
    global?(id: number): string;
    /** A constant written to a save- or temp-area cell (absolute address). */
    value?(addr: number, value: number): string;
    map?(id: number): string;
    /** An ENEMY value. */
    enemy?(index: number): string;
    /** The constant of enum `type` (`MUSIC`, `SCRIPT_TRIGGER`) with this value. */
    constant?(type: string, value: number): string;
    /** Whether enum `type` has `value` (a constant, named or not); null when it cannot say (no such enum, an open set like trigger ids). */
    inEnum?(type: string, value: number): boolean | null;
    /**
     * A cell of the slot's local bytes (`local`, offset) or of the temp area (`temp`, offset from
     * $2834) by its slice's name (`arg.entity_1`, `temp.flags_1`); `width` 0 for a flag. The name
     * carries the width, so no `(Byte)` is printed with it.
     */
    slice?(area: 'local' | 'temp', offset: number, width: 0 | 1 | 2): string;
    /** A field of an entity record by its offset (`0x1a` → `x`). */
    field?(offset: number): string;
    /** Numbers read in decimal, except where a parameter wants hex (parameters.json `hex`) and in addresses, masks and ids. */
    decimal?: boolean;
}

const hex = (v: number, w = 2): string => '0x' + hexLower(v, w);
const bus = (a: number): string => '$' + (a >>> 16).toString(16).padStart(2, '0') + ':' + (a & 0xFFFF).toString(16).padStart(4, '0');
export const constText = (v: number): string => (v < 0 ? String(v) : v < 10 ? String(v) : hex(v, v > 0xFF ? 4 : 2));

const AREA_BASE: Record<string, number> = { save: 0x2258, temp: 0x2834 };
const TEMP = 0x2834;

/** What is wrong with a printed line: `find`'s `nth` occurrence (0-based), or the whole line when `find` is absent. */
export interface Mark { severity: 'error' | 'warning'; message: string; find?: string; nth?: number }

/** Stand before a `signed` the printer marks (why: tested for zero, an entity); removed (and turned into Marks) by `printed()`. */
const USELESS = '\u0001', POINTER = '\u0002';
type Why = '' | 'zero' | 'pointer';

const inTemp = (addr: number): boolean => addr >= TEMP && addr < TEMP + 200;
/** An unnamed save- or temp-area cell: its slice, else `temp[n]` / `<0x2391>`; `sized`: the name carries the width. */
function cellName(addr: number, names: Names, width: 1 | 2): { text: string; sized: boolean } {
    const slice = inTemp(addr) ? names.slice?.('temp', addr - TEMP, width) : '';
    return slice ? { text: slice, sized: true } : { text: inTemp(addr) ? `temp[${addr - TEMP}]` : `<${hex(addr, 4)}>`, sized: false };
}
function flagCell(addr: number, mask: number, names: Names): string {
    const slice = inTemp(addr) ? names.slice?.('temp', addr - TEMP, 0) : '';
    if (slice) return `${slice}[${hex(mask)}]`;
    return inTemp(addr) ? `temp_flag[${addr - TEMP}, ${hex(mask)}]` : `<${hex(addr, 4)}, ${hex(mask)}>`;
}
/** The slot's local bytes: arg[n], arg_flag[n, mask], or their slice. */
function localCell(offset: number, names: Names, width: 1 | 2): { text: string; sized: boolean } {
    const slice = names.slice?.('local', offset, width);
    return slice ? { text: slice, sized: true } : { text: `arg[${offset}]`, sized: false };
}
function localFlag(offset: number, mask: number, names: Names): string {
    const slice = names.slice?.('local', offset, 0);
    return slice ? `${slice}[${hex(mask)}]` : `arg_flag[${offset}, ${hex(mask)}]`;
}
const PRECEDENCE: Record<string, number> = {
    '||': 1, '&&': 2, '|': 3, '^': 4, '&': 5, '==': 6, '!=': 6, '<': 7, '>': 7, '<=': 7, '>=': 7,
    '<<': 8, '>>': 8, '+': 9, '-': 9, '*': 10, '/': 10,
};

function termText(t: Term, names: Names, useless: Why = ''): string {
    const s = t.spec;
    const v = t.value ?? 0;
    if (s.kind === 'flag') {
        if (s.area === 'local') return localFlag(v >> 3, 1 << (v & 7), names);
        const addr = AREA_BASE[s.area!] + (v >> 3), mask = 1 << (v & 7);
        return names.flag?.(addr, mask) || flagCell(addr, mask, names);
    }
    if (s.kind === 'read') {
        const w = s.width === 1 ? 1 : 2;
        const named = s.area === 'local' ? '' : names.memory?.(AREA_BASE[s.area!] + v) || '';
        const cell = named ? { text: named, sized: false } : s.area === 'local' ? localCell(v, names, w) : cellName(AREA_BASE[s.area!] + v, names, w);
        const width = s.width === 1 && !cell.sized ? '(Byte)' : '';
        return (s.signed ? (useless === 'zero' ? USELESS : useless === 'pointer' ? POINTER : '') + 'signed ' : '') + width + cell.text;
    }
    return `${s.name}()`;
}

/**
 * `truth`: the node's value is only tested for zero (a branch, `!`, `&&`, `||`), where a sign
 * extension cannot matter: it only fills the high word of a value that is not zero anyway.
 */
function nodeText(n: Node, names: Names, outer = 0, truth: Why = ''): string {
    switch (n.k) {
        case 'const': return names.decimal ? String(n.value) : constText(n.value);
        case 'read': return termText(n.term, names, truth);
        case 'value': return termText(n.term, names);
        case 'unknown': return '?';
        case 'unary': {
            const f = fieldText(n, names);
            if (f) return f;
            const a = nodeText(n.arg, names, 11, n.op === '!' ? 'zero' : '');
            if (n.op === '!' || n.op === '~' || n.op === '-') return n.op + a;
            return `${n.op}(${nodeText(n.arg, names)})`;
        }
        case 'binary': {
            const p = PRECEDENCE[n.op] ?? 0;
            const logic = n.op === '&&' || n.op === '||';
            const eq = n.op === '==' || n.op === '!=';
            const cmp = eq || n.op === '<' || n.op === '>' || n.op === '<=' || n.op === '>=';
            const side = (a: Node, b: Node, q: number): string => {
                const named = cmp && a.k === 'const' ? compared(b, a.value, names) : '';
                return named || nodeText(a, names, q, logic || (eq && signless(a, b)) ? 'zero' : '');
            };
            const s = `${side(n.left, n.right, p)} ${n.op} ${side(n.right, n.left, p + 1)}`;
            return p < outer ? `(${s})` : s;
        }
    }
}

/**
 * A signed read compared for (in)equality with a constant its sign extension cannot reach: the
 * read is negative exactly when its top bit is set, and then its low byte or word already differs
 * from a constant in 0..$7F (a byte) or 0..$7FFF (a word) — the comparison reads the same unsigned.
 */
function signless(read: Node, other: Node): boolean {
    if (read.k !== 'read' || other.k !== 'const') return false;
    return other.value >= 0 && other.value < (read.term.spec.width === 1 ? 0x80 : 0x8000);
}

/** The entity sub-ops (`boy()`, `camera_entity()`): a value that is an entity record's address. */
const ENTITIES = new Set(['last_entity', 'script_owner', 'boy', 'dog', 'camera_entity', 'other_character']);

/** `entity.field` for an entity sub-op or a cell sliced as one, plus a named offset (`boy() + 0x1a` → `boy.x`); '' otherwise. */
function entityField(n: Node, names: Names): string {
    const base = n.k === 'binary' && n.op === '+' && n.right.k === 'const' ? n.left : n;
    const offset = base === n ? 0 : (n as { right: { value: number } }).right.value;
    const field = names.field?.(offset);
    if (!field) return '';
    if (base.k === 'value' && ENTITIES.has(base.term.spec.name)) return `${base.term.spec.name}.${field}`;
    // A cell sliced as an entity (`arg.entity_1`): its sign cannot matter, the address is a word.
    if (base.k === 'read' && base.term.spec.width === 2) {
        const cell = termText({ ...base.term, spec: { ...base.term.spec, signed: false } }, names);
        if (/\.entity_\d+$/.test(cell)) return `${cell}.${field}`;
    }
    return '';
}

/** `deref(boy() + 0x1a)` read as `boy.x` (`(Byte)boy.x` for `deref_byte`); '' when the field has no name. */
function fieldText(n: Node, names: Names): string {
    if (n.k !== 'unary' || (n.op !== 'deref' && n.op !== 'deref_byte')) return '';
    const f = entityField(n.arg, names);
    return f ? (n.op === 'deref_byte' ? '(Byte)' : '') + f : '';
}

/** A constant compared with a save- or temp-area cell, by the name of that cell's value; '' when it has none. */
function compared(read: Node, value: number, names: Names): string {
    if (read.k !== 'read' || read.term.spec.area === 'local' || !read.term.spec.area) return '';
    return names.value?.(AREA_BASE[read.term.spec.area] + (read.term.value ?? 0), value) || '';
}

const MARKERS = new RegExp(`[${USELESS}${POINTER}]`, 'g');

export function expressionText(e: Expression, names: Names = {}, truth = false): string {
    return nodeText(tree(e), names, 0, truth ? 'zero' : '').replace(MARKERS, '');
}

/** `expressionText`, with the markers `printed()` turns into warnings. */
const marked = (e: Expression, names: Names, truth: Why = ''): string => nodeText(tree(e), names, 0, truth);

/**
 * A constant of enum `type` — one of ours (parameters.json `enums`, with the compiler enum it adds
 * to) or the compiler's: its name; for a flags enum its named bits joined with |, any rest a number
 * (`SPAWNER | PHASING`, `INSTANT | 2`); else the number (`fmt`) — with a warning in `marks` when
 * the compiler's enum is closed and has no constant for it.
 */
function enumText(type: string, value: number, fmt: (v: number) => string, names: Names, marks: Mark[]): string {
    const own = ownEnum(type);
    const one = (v: number): string => own?.values.get(v) || (own ? (own.base ? names.constant?.(own.base, v) : '') : names.constant?.(type, v)) || '';
    const name = one(value);
    if (name) return name;
    if (own?.flags) {
        const parts: string[] = [];
        let rest = value;
        for (let bit = 0x8000; bit; bit >>= 1) {
            const n = rest & bit ? one(bit) : '';
            if (n) { parts.push(n); rest &= ~bit; }
        }
        return parts.length ? [...parts, ...(rest ? [fmt(rest)] : [])].join(' | ') : fmt(value);
    }
    const text = fmt(value);
    if (!own && names.inEnum?.(type, value) === false) marks.push({ severity: 'warning', find: text, nth: 0, message: `${text} is not a ${type} value: the enum has no constant for it. Only its values are meant here; if the game uses this one, the enum is missing it.` });
    return text;
}

/** A number as the reader wants it: decimal where `names.decimal` says so and the parameter does not want hex; `w` hex digits otherwise (0: constText's). */
function numText(v: number, names: Names, p?: Parameter, w = 0): string {
    if (names.decimal && !p?.hex) return String(v);
    return w ? hex(v, w) : constText(v);
}

/** `p`: what the operand is (parameters.json): its enum names a constant, an entity's `signed` is marked. */
function operandText(o: Operand, names: Names, truth = false, p: Parameter | undefined = undefined, marks: Mark[] = []): string {
    const typed = (v: number, w: number): string => (p?.enum ? enumText(p.enum, v, (x) => numText(x, names, p, w), names, marks) : numText(v, names, p, w));
    switch (o.k) {
        case 'u8': case 'skip': return typed(o.value, 2);
        case 'u16': return typed(o.value, 4);
        case 'E': {
            const n = tree(o.expr);
            if (n.k === 'const' && p?.enum) return typed(n.value, 0);
            return marked(o.expr, p?.hex ? { ...names, decimal: false } : names, truth ? 'zero' : p?.type === 'entity' ? 'pointer' : '');
        }
        case 'A': return o.args.map((a) => marked(a, names)).join(', ');
        case 'Z': return '[' + o.list.map((a) => marked(a, names)).join(', ') + ']';
        default: return bus(o.target);
    }
}

function target(addr: number | null, names: Names): string {
    if (addr === null) return '?';
    return names.script?.(addr) || bus(addr);
}

function cell(area: string, addr: number, width: 1 | 2, names: Names): string {
    const named = area === 'local' ? '' : names.memory?.(addr) || '';
    const c = named ? { text: named, sized: false } : area === 'local' ? localCell(addr, names, width) : cellName(addr, names, width);
    return (width === 1 && !c.sized ? '(Byte)' : '') + c.text;
}

/** The instruction as one line of text. */
export function text(ins: Instruction, names: Names = {}): string {
    return printed(ins, names).text;
}

/** The instruction as one line of text, and what is wrong with it. */
export function printed(ins: Instruction, names: Names = {}): { text: string; marks: Mark[] } {
    const extra: Mark[] = [];
    const raw = line(ins, names, extra);
    const marks: Mark[] = [];
    if (!ins.spec.name) marks.push({ severity: 'error', message: `Opcode $${hexLower(ins.opcode, 2)} has no name: what its handler does is not known yet.` });
    const parts = raw.split(MARKERS);
    const why = raw.match(MARKERS) ?? [];
    let seen = 0;
    for (let i = 1; i < parts.length; i++) {
        seen += (parts[i - 1].match(/\bsigned\b/g) ?? []).length;
        marks.push({
            severity: 'warning', find: 'signed', nth: seen,
            message: why[i - 1] === POINTER
                ? 'signed changes nothing here: this parameter is an entity, and the handler takes only the low word of its address, which a sign extension never touches. The unsigned read is the same size.'
                : 'signed changes nothing here: the value is only tested for zero or compared with a small constant, which reads the same unsigned. The unsigned read is the same size.',
        });
    }
    return { text: parts.join(''), marks: [...marks, ...extra] };
}

function line(ins: Instruction, names: Names, marks: Mark[]): string {
    const f: Fact = facts(ins);
    const o = ins.operands;
    const params = parameters(ins.opcode);
    const E = (k: number, truth = false): string => operandText(o[k], names, truth, params[k], marks);
    const enumOf = (k: number, v: number, w = 2): string => {
        const fmt = (x: number): string => numText(x, names, params[k], w);
        return params[k]?.enum ? enumText(params[k].enum!, v, fmt, names, marks) : fmt(v);
    };
    // Arguments go inside the head's own parentheses when it has them: `call_id(NAME, 0x78)`.
    const withArgs = (head: string): string => (!(o[0] && o[0].k === 'A') ? head : head.endsWith(')') ? `${head.slice(0, -1)}, ${E(0)})` : `${head}(${E(0)})`);
    switch (f.k) {
        case 'write': {
            const named = f.value !== null && f.area !== 'local' ? names.value?.(f.addr, f.value) : '';
            return `${cell(f.area, f.addr, f.width, names)} = ${named || (f.expr ? marked(f.expr, names) : numText(f.value ?? 0, names))};`;
        }
        case 'flag': {
            const name = f.area === 'local' ? localFlag(f.addr, f.mask, names) : (names.flag?.(f.addr, f.mask) || flagCell(f.addr, f.mask, names));
            return `${name} = ${marked(f.expr, names)};`;
        }
        case 'tilePair': return `(${cell(f.area, f.xAddr, 2, names)}, ${cell(f.area, f.yAddr, 2, names)}) = (${f.x}, ${f.y});`;
        case 'call': {
            // A short callee (a global id, a trigger offset) reads by its name: the global's, else the script's.
            const short = f.global !== null || f.trigger !== null;
            const named = !short ? '' : (f.global !== null ? names.global?.(f.global) : '') || (f.target !== null ? names.script?.(f.target) : '') || '';
            const head = f.global !== null ? `call_id(${named || hex(f.global)})` : f.trigger !== null ? `call_trigger(${named || hex(f.trigger, 4)})` : `call ${target(f.target, names)}`;
            const via = short && !named ? target(f.target, names) : '';
            return `${withArgs(head)};${via ? ` // ${via}` : ''}`;
        }
        case 'start': return `${withArgs(`async ${target(f.target, names)}`)};`;
        case 'changeMap': {
            if (f.map === null) return `restart_room_at(${f.x}, ${f.y});`;
            const notes = [names.map?.(f.map) || '', f.word !== null && f.word > 0xFF ? `word ${hex(f.word, 4)}` : ''].filter(Boolean);
            return `load_map(${enumOf(2, f.map)}, ${f.x}, ${f.y});${notes.length ? ` // ${notes.join(', ')}` : ''}`;
        }
        case 'sound': return `sound(${enumOf(0, f.index)});`;
        case 'music': return `music(${enumOf(0, f.index)});`;
        case 'text': return `${f.message ? 'subtext' : 'text'}(${f.window !== null ? f.window + ', ' : ''}${hex(f.key, 4)});`;
        // A spawner says so by its name: bit 15 is not printed again.
        case 'spawn': { const state = f.spawner ? (f.state ?? 0) & 0x7fff : f.state; return `${f.spawner ? 'spawner' : 'spawn'}(${names.enemy?.(f.index) || hex(f.index)}, ${f.x === null ? `${E(2)}, ${E(3)}` : `${f.x}, ${f.y}`}${state ? ', ' + enumOf(1, state, 4) : ''});`; }
        case 'sleep': return `sleep(${f.ticks === null ? E(0) : f.ticks});`;
        case 'yield': return 'yield();';
        case 'end': return 'return;';
        default: break;
    }
    switch (ins.opcode) {
        case 0x04: case 0x05: return `goto ${bus(ins.target!)};`;
        case 0x08: return `if (${E(0, true)}) goto ${bus(ins.target!)};`;
        case 0x09: return `if! (${E(0, true)}) goto ${bus(ins.target!)};`;
        case 0x0A: return `if (currency[${E(0)}] >= ${numText(num(o[1]) | (num(o[2]) << 16), names, undefined, 6)}) goto ${bus(ins.target!)};`;
        case 0x0B: return `if (currency[${E(0)}] < ${numText(num(o[1]) | (num(o[2]) << 16), names, undefined, 6)}) goto ${bus(ins.target!)};`;
        case 0x8E: return `if (currency[${E(0)}] >= ${E(1)}) goto ${bus(ins.target!)};`;
        case 0x8F: return `if (currency[${E(0)}] < ${E(1)}) goto ${bus(ins.target!)};`;
        case 0x5C: return `object[${E(0)}] = ${E(1)};`;
        case 0x5F: return `object[${E(0)}] += ${numText(num(o[1]), names, undefined, 4)};`;
        case 0x60: return `object[${E(0)}]++;`;
        case 0x61: return `object[${E(0)}]--;`;
        case 0x74: return `face(${E(0)}, NORTH);`;
        case 0x75: return `face(${E(0)}, SOUTH);`;
        case 0x76: return `face(${E(0)}, WEST);`;
        case 0x77: return `face(${E(0)}, EAST);`;
        case 0x7A: {
            const f = o[0].k === 'E' ? entityField(tree(o[0].expr), names) : '';
            if (f) return `${f} = ${E(1)};`;
            break;
        }
        case 0xAB: return 'reset_game();';
        default: break;
    }
    const name = ins.spec.name || `op_${ins.opcode.toString(16).padStart(2, '0')}`;
    const texts = o.map((x, k) => (x.k === 'skip' || x.k === 'r16' ? null : E(k))).filter((t): t is string => t !== null);
    const jump = ins.flow === 'branch' && ins.target !== null ? ` goto ${bus(ins.target)}` : '';
    return `${name}(${texts.join(', ')})${jump};`;
}

function num(o: Operand | undefined): number { return o && 'value' in o ? o.value : 0; }

/** Everscript that compiles to exactly the instruction's bytes: the raw bytes, with the text as a comment. */
export function everscript(ins: Instruction, bytes: ArrayLike<number>, names: Names = {}): string {
    return `code(${Array.from(bytes, (b) => hex(b)).join(', ')}); // ${text(ins, names)}`;
}
