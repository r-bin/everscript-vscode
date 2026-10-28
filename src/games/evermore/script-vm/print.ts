// Ownership: an instruction as one line of text in the Everscript compiler's notation — `<0x2391>`
// for a word, `<0x2260, 0x10>` for a flag, `arg[n]` for the slot's local bytes, `goto`, `call` —
// with our names for the opcodes (spec.ts) and the caller's names for memory, scripts and maps.
// An unnamed cell of the room's temp area ($2834, 200 bytes) reads `temp[n]`, like `arg[n]`.
// Pure. This is for reading; `everscript()` gives the form that compiles back to the same bytes.
//
// `printed()` also says what is wrong with the line (`Mark`): an error for an opcode we have no
// name for, a warning for a `signed` read whose sign cannot change the result.

import { Instruction, Operand } from './decode';
import { Expression, Node, Term, tree } from './expression';
import { Fact, facts } from './facts';
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
}

const hex = (v: number, w = 2): string => '0x' + hexLower(v, w);
const bus = (a: number): string => '$' + (a >>> 16).toString(16).padStart(2, '0') + ':' + (a & 0xFFFF).toString(16).padStart(4, '0');
const constText = (v: number): string => (v < 0 ? String(v) : v < 10 ? String(v) : hex(v, v > 0xFF ? 4 : 2));

const AREA_BASE: Record<string, number> = { save: 0x2258, temp: 0x2834 };
const TEMP = 0x2834;

/** What is wrong with a printed line: `find`'s `nth` occurrence (0-based), or the whole line when `find` is absent. */
export interface Mark { severity: 'error' | 'warning'; message: string; find?: string; nth?: number }

/** Stands before a `signed` the printer marks; removed (and turned into a Mark) by `printed()`. */
const USELESS = '\u0001';

/** An unnamed save- or temp-area cell. */
const cellName = (addr: number): string => (addr >= TEMP && addr < TEMP + 200 ? `temp[${addr - TEMP}]` : `<${hex(addr, 4)}>`);
const flagCell = (addr: number, mask: number): string => (addr >= TEMP && addr < TEMP + 200 ? `temp_flag[${addr - TEMP}, ${hex(mask)}]` : `<${hex(addr, 4)}, ${hex(mask)}>`);
const PRECEDENCE: Record<string, number> = {
    '||': 1, '&&': 2, '|': 3, '^': 4, '&': 5, '==': 6, '!=': 6, '<': 7, '>': 7, '<=': 7, '>=': 7,
    '<<': 8, '>>': 8, '+': 9, '-': 9, '*': 10, '/': 10,
};

function termText(t: Term, names: Names, useless = false): string {
    const s = t.spec;
    const v = t.value ?? 0;
    if (s.kind === 'flag') {
        if (s.area === 'local') return `arg_flag[${v >> 3}, ${hex(1 << (v & 7))}]`;
        const addr = AREA_BASE[s.area!] + (v >> 3), mask = 1 << (v & 7);
        return names.flag?.(addr, mask) || flagCell(addr, mask);
    }
    if (s.kind === 'read') {
        const cell = s.area === 'local' ? `arg[${v}]` : (names.memory?.(AREA_BASE[s.area!] + v) || cellName(AREA_BASE[s.area!] + v));
        const width = s.width === 1 ? '(Byte)' : '';
        return (s.signed ? (useless ? USELESS : '') + 'signed ' : '') + width + cell;
    }
    return `${s.name}()`;
}

/**
 * `truth`: the node's value is only tested for zero (a branch, `!`, `&&`, `||`), where a sign
 * extension cannot matter: it only fills the high word of a value that is not zero anyway.
 */
function nodeText(n: Node, names: Names, outer = 0, truth = false): string {
    switch (n.k) {
        case 'const': return constText(n.value);
        case 'read': return termText(n.term, names, truth);
        case 'value': return termText(n.term, names);
        case 'unknown': return '?';
        case 'unary': {
            const a = nodeText(n.arg, names, 11, n.op === '!');
            if (n.op === '!' || n.op === '~' || n.op === '-') return n.op + a;
            return `${n.op}(${nodeText(n.arg, names)})`;
        }
        case 'binary': {
            const p = PRECEDENCE[n.op] ?? 0;
            const logic = n.op === '&&' || n.op === '||';
            const eq = n.op === '==' || n.op === '!=';
            const s = `${nodeText(n.left, names, p, logic || (eq && signless(n.left, n.right)))} ${n.op} ${nodeText(n.right, names, p + 1, logic || (eq && signless(n.right, n.left)))}`;
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

export function expressionText(e: Expression, names: Names = {}, truth = false): string {
    return nodeText(tree(e), names, 0, truth).split(USELESS).join('');
}

/** `expressionText`, with the marker `printed()` turns into warnings. */
const marked = (e: Expression, names: Names, truth = false): string => nodeText(tree(e), names, 0, truth);

function operandText(o: Operand, names: Names, truth = false): string {
    switch (o.k) {
        case 'u8': case 'skip': return hex(o.value);
        case 'u16': return hex(o.value, 4);
        case 'E': return marked(o.expr, names, truth);
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
    const c = area === 'local' ? `arg[${addr}]` : (names.memory?.(addr) || cellName(addr));
    return (width === 1 ? '(Byte)' : '') + c;
}

/** The instruction as one line of text. */
export function text(ins: Instruction, names: Names = {}): string {
    return printed(ins, names).text;
}

/** The instruction as one line of text, and what is wrong with it. */
export function printed(ins: Instruction, names: Names = {}): { text: string; marks: Mark[] } {
    const raw = line(ins, names);
    const marks: Mark[] = [];
    if (!ins.spec.name) marks.push({ severity: 'error', message: `Opcode $${hexLower(ins.opcode, 2)} has no name: what its handler does is not known yet.` });
    const parts = raw.split(USELESS);
    let seen = 0;
    for (let i = 1; i < parts.length; i++) {
        seen += (parts[i - 1].match(/\bsigned\b/g) ?? []).length;
        marks.push({ severity: 'warning', find: 'signed', nth: seen, message: 'signed changes nothing here: the value is only tested for zero or compared with a small constant, which reads the same unsigned. The unsigned read is the same size.' });
    }
    return { text: parts.join(''), marks };
}

function line(ins: Instruction, names: Names): string {
    const f: Fact = facts(ins);
    const o = ins.operands;
    const E = (k: number, truth = false): string => operandText(o[k], names, truth);
    const withArgs = (head: string): string => (o[0] && o[0].k === 'A' ? `${head}(${E(0)})` : head);
    switch (f.k) {
        case 'write': {
            const named = f.value !== null && f.area !== 'local' ? names.value?.(f.addr, f.value) : '';
            return `${cell(f.area, f.addr, f.width, names)} = ${named || (f.expr ? marked(f.expr, names) : constText(f.value ?? 0))};`;
        }
        case 'flag': {
            const name = f.area === 'local' ? `arg_flag[${f.addr}, ${hex(f.mask)}]` : (names.flag?.(f.addr, f.mask) || flagCell(f.addr, f.mask));
            return `${name} = ${marked(f.expr, names)};`;
        }
        case 'tilePair': return `(${cell(f.area, f.xAddr, 2, names)}, ${cell(f.area, f.yAddr, 2, names)}) = (${f.x}, ${f.y});`;
        case 'call': {
            const head = f.global !== null ? `call_id(${hex(f.global)})` : f.trigger !== null ? `call_trigger(${hex(f.trigger, 4)})` : `call ${target(f.target, names)}`;
            const via = f.global !== null ? (names.global?.(f.global) || target(f.target, names)) : f.trigger !== null ? target(f.target, names) : '';
            return `${withArgs(head)};${via ? ` // ${via}` : ''}`;
        }
        case 'start': return `${withArgs(`async ${target(f.target, names)}`)};`;
        case 'changeMap': {
            if (f.map === null) return `restart_room_at(${f.x}, ${f.y});`;
            const notes = [names.map?.(f.map) || '', f.word !== null && f.word > 0xFF ? `word ${hex(f.word, 4)}` : ''].filter(Boolean);
            return `load_map(${hex(f.map)}, ${f.x}, ${f.y});${notes.length ? ` // ${notes.join(', ')}` : ''}`;
        }
        case 'sound': return `sound(${hex(f.index)});`;
        case 'music': return `music(${hex(f.index)});`;
        case 'text': return `${f.message ? 'subtext' : 'text'}(${f.window !== null ? f.window + ', ' : ''}${hex(f.key, 4)});`;
        case 'spawn': return `${f.spawner ? 'spawner' : 'spawn'}(${names.enemy?.(f.index) || hex(f.index)}, ${f.x === null ? `${E(2)}, ${E(3)}` : `${f.x}, ${f.y}`}${f.state ? ', ' + hex(f.state, 4) : ''});`;
        case 'sleep': return `sleep(${f.ticks === null ? E(0) : f.ticks});`;
        case 'yield': return 'yield();';
        case 'end': return 'end();';
        default: break;
    }
    switch (ins.opcode) {
        case 0x04: case 0x05: return `goto ${bus(ins.target!)};`;
        case 0x08: return `if (${E(0, true)}) goto ${bus(ins.target!)};`;
        case 0x09: return `if! (${E(0, true)}) goto ${bus(ins.target!)};`;
        case 0x0A: return `if (currency[${E(0)}] >= ${hex(num(o[1]) | (num(o[2]) << 16), 6)}) goto ${bus(ins.target!)};`;
        case 0x0B: return `if (currency[${E(0)}] < ${hex(num(o[1]) | (num(o[2]) << 16), 6)}) goto ${bus(ins.target!)};`;
        case 0x8E: return `if (currency[${E(0)}] >= ${E(1)}) goto ${bus(ins.target!)};`;
        case 0x8F: return `if (currency[${E(0)}] < ${E(1)}) goto ${bus(ins.target!)};`;
        case 0x5C: return `object[${E(0)}] = ${E(1)};`;
        case 0x5F: return `object[${E(0)}] += ${hex(num(o[1]), 4)};`;
        case 0x60: return `object[${E(0)}]++;`;
        case 0x61: return `object[${E(0)}]--;`;
        case 0x74: return `face(${E(0)}, NORTH);`;
        case 0x75: return `face(${E(0)}, SOUTH);`;
        case 0x76: return `face(${E(0)}, WEST);`;
        case 0x77: return `face(${E(0)}, EAST);`;
        case 0xAB: return 'reset_game();';
        default: break;
    }
    const name = ins.spec.name || `op_${ins.opcode.toString(16).padStart(2, '0')}`;
    const shown = o.filter((x) => x.k !== 'skip' && x.k !== 'r16').map((x) => operandText(x, names));
    const jump = ins.flow === 'branch' && ins.target !== null ? ` goto ${bus(ins.target)}` : '';
    return `${name}(${shown.join(', ')})${jump};`;
}

function num(o: Operand | undefined): number { return o && 'value' in o ? o.value : 0; }

/** Everscript that compiles to exactly the instruction's bytes: the raw bytes, with the text as a comment. */
export function everscript(ins: Instruction, bytes: ArrayLike<number>, names: Names = {}): string {
    return `code(${Array.from(bytes, (b) => hex(b)).join(', ')}); // ${text(ins, names)}`;
}
