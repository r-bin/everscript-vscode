// Ownership: evaluating one script operand to a value. Pure.
//
// Written from two sources of our own, not from the legacy decoder's code:
// the operand table in the sibling `everscript` compiler (`Operand._operands`
// in compiler/ast_core.py, which is the side that *emits* these bytes and
// documents each one as "res = pulled OP res"), and
// docs/script-format/operand_grammar.md. Byte widths the compiler leaves open
// were fixed by measurement: tests/simulation/operand-parity.test.js parses
// every operand of every executed instruction in the ROM and requires the
// length to agree with the decoder's instruction boundaries.
//
// Shape: a postfix machine with one accumulator `res` and a stack. Each byte
// is an operator (bits 0-6) and the last operator of the operand has bit 7
// set; an operator's own argument bytes follow it, so the operand ends after
// the terminating operator's arguments.

import { Sym, c, bin, un, bit, truthy, key, ramHex } from './sym';
import { Memory, SAVE_BASE, TEMP_BASE, flagAddr } from './memory';
import { rngBelow } from './rng';

export interface EvalContext {
    mem: Memory;
    /** Shared with later operands: scripts push in one and pop in the next. */
    stack: Sym[];
    /** Script argument `index` (a byte offset into the argument block). */
    arg(index: number): Sym;
    /** The entity the last spawn placed (`$0341`). */
    lastEntity: Sym;
    /** The entity the running script is attached to. */
    owner: Sym;
    /** A value nothing in the model determines, named for the report. */
    fresh(name: string): Sym;
    /** The game timer's low (`$0B19`) or high (`$0B1B`) word now. */
    timer?(high: boolean): Sym;
    /** One draw of the game's RNG ($80:859B), advancing its state in WRAM. */
    random?(): Sym;
}

export interface Operand {
    value: Sym;
    /** The operand as Everscript-like source, unevaluated. */
    src: string;
    length: number;
    ok: boolean;
}

const ENTITIES: Record<number, string> = {
    0x50: '<BOY>', 0x51: '<DOG>', 0x52: '<ACTIVE>', 0x53: '<INACTIVE>',
};

const BINARY: Record<number, string> = {
    0x17: '*', 0x18: '/', 0x1a: '+', 0x1b: '-', 0x1c: '<<', 0x1d: '>>',
    0x1e: '<', 0x1f: '>', 0x20: '<=', 0x21: '>=', 0x22: '==', 0x23: '!=',
    0x24: '&', 0x25: '|', 0x26: '^', 0x27: '||', 0x28: '&&',
};

const hx = (v: number, d: number): string => '0x' + v.toString(16).padStart(d, '0');
const sx8 = (v: number): number => (v & 0x80 ? v | 0xff00 : v);

/** The value an inline-constant operator carries, or null if it is not one. */
export function inlineConstant(op: number): number | null {
    switch (op & 0x70) {
        case 0x30: return op & 0x0f;
        case 0x40: return 0xfff0 | (op & 0x0f);
        case 0x60: return 0x10 + (op & 0x0f);
        default: return null;
    }
}

/** Entities the controlled/uncontrolled tokens resolve to, as stable unknowns. */
function entityToken(op: number, ctx: EvalContext): Sym | null {
    if (op === 0x50) return { k: 'ent', id: -1, label: 'boy' };
    if (op === 0x51) return { k: 'ent', id: -2, label: 'dog' };
    if (op === 0x52) return { k: 'atom', name: 'controlled char', volatile: false };
    if (op === 0x53) return { k: 'atom', name: 'non-controlled char', volatile: false };
    if (op === 0x2d) return ctx.lastEntity;
    if (op === 0x2e) return ctx.owner;
    return null;
}

export function evalOperand(rom: Uint8Array, at: number, toFile: (snes: number) => number, ctx: EvalContext): Operand {
    let pos = at;
    const u8 = (): number => rom[toFile(pos++)];
    const u16 = (): number => { const v = u8(); return v | (u8() << 8); };
    let res: Sym = c(0);
    let src = '0';
    const srcStack: string[] = [];
    for (let guard = 0; guard < 1024; guard++) {
        const b = u8();
        const op = b & 0x7f;
        const last = (b & 0x80) !== 0;
        const ent = entityToken(op, ctx);
        const inl = inlineConstant(op);
        if (ent) {
            res = ent;
            src = op === 0x2d ? 'LAST_ENTITY' : op === 0x2e ? 'SCRIPT_OWNER' : ENTITIES[op];
        } else if (inl !== null) {
            res = c(inl);
            src = inl & 0x8000 ? String((inl & 0xffff) - 0x10000) : hx(inl, 2);
        } else if (BINARY[op]) {
            const pulled = ctx.stack.pop() ?? ctx.fresh('empty stack');
            res = bin(BINARY[op], pulled, res);
            src = `(${srcStack.pop() ?? '?'} ${BINARY[op]} ${src})`;
        } else {
            switch (op) {
                case 0x00: break;
                case 0x01: { const v = sx8(u8()); res = c(v); src = hx(v & 0xffff, 2); break; }
                case 0x02: { const v = u8(); res = c(v); src = hx(v, 2); break; }
                case 0x03: case 0x04: { const v = u16(); res = c(v); src = hx(v, 4); break; }
                case 0x05: case 0x0a: {
                    const f = flagAddr(u16(), op === 0x05 ? SAVE_BASE : TEMP_BASE);
                    res = ctx.mem.readBit(f.addr, f.bit);
                    src = `<${hx(f.addr, 4)}, ${hx(1 << f.bit, 2)}>`;
                    break;
                }
                case 0x06: case 0x07: case 0x0b: case 0x0c: {
                    const a = (u16() + (op <= 0x07 ? SAVE_BASE : TEMP_BASE)) & 0xffff;
                    res = ctx.mem.readByte(a);
                    if (op === 0x06 || op === 0x0b) res = un('sx8', res);
                    src = op === 0x06 || op === 0x0b ? `signed(<${hx(a, 4)}>.b)` : `<${hx(a, 4)}>.b`;
                    break;
                }
                case 0x08: case 0x09: case 0x0d: case 0x0e: {
                    const a = (u16() + (op <= 0x09 ? SAVE_BASE : TEMP_BASE)) & 0xffff;
                    res = ctx.mem.readWord(a);
                    src = op === 0x08 || op === 0x0d ? `signed(<${hx(a, 4)}>)` : `<${hx(a, 4)}>`;
                    break;
                }
                case 0x0f: { const i = u8(); res = ctx.fresh(`arg bit ${i}`); src = `arg_bit[${hx(i, 2)}]`; break; }
                case 0x10: case 0x11: case 0x12: case 0x13: {
                    const i = u8();
                    res = ctx.arg(i);
                    if (op <= 0x11) res = bin('&', res, c(0xff));
                    src = `arg[${hx(i, 2)}]`;
                    break;
                }
                // Parenthesised: in Everscript `!` binds looser than `&&`, so `!a && b` would mean `!(a && b)`.
                case 0x14: res = un('!', truthy(res)); src = `(!${src})`; break;
                case 0x15: res = un('~', res); src = `~${src}`; break;
                case 0x16: res = un('-', res); src = `-${src}`; break;
                case 0x29: ctx.stack.push(res); srcStack.push(src); break;
                case 0x2a: res = ctx.random ? ctx.random() : ctx.fresh('random'); src = 'random()'; break;
                case 0x2b: {
                    const r = ctx.random ? ctx.random() : ctx.fresh('random');
                    res = r.k === 'c' && res.k === 'c' ? c(rngBelow(r.v, res.v)) : ctx.fresh(`random below ${key(res)}`);
                    src = `randrange(${src})`;
                    break;
                }
                case 0x2c: res = ctx.fresh(`dialog choice`); src = `dialog_response(${src})`; break;
                case 0x54: { const i = u8(); res = ctx.fresh(`script data ${hx(i, 2)}`); src = `script[${hx(i, 2)}]`; break; }
                case 0x55: case 0x56: {
                    res = res.k === 'c'
                        ? (op === 0x55 ? ctx.mem.readWord(res.v) : ctx.mem.readByte(res.v))
                        : ctx.fresh(`*(${key(res)})`);
                    src = `*${src}`;
                    break;
                }
                case 0x57: res = { k: 'atom', name: 'dog is controlled', volatile: false }; src = 'DOG_ACTIVE'; break;
                case 0x58: case 0x59: res = ctx.timer ? ctx.timer(op === 0x59) : ctx.fresh('game timer'); src = op === 0x58 ? 'time0()' : 'time2()'; break;
                case 0x5a: case 0x5b: res = ctx.fresh('shop result'); src = 'shop()'; break;
                case 0x5c: res = ctx.fresh(`${key(res)} dies to next hit`); src = `dead(${src})`; break;
                default:
                    return { value: ctx.fresh('unparsed operand'), src: '?', length: pos - at, ok: false };
            }
        }
        if (last) return { value: res, src, length: pos - at, ok: true };
    }
    return { value: ctx.fresh('unparsed operand'), src: '?', length: pos - at, ok: false };
}

/** `$2391` / `$2266&0x80` — how a write target reads in a report. */
export function describeTarget(addr: number, size: 1 | 2): string {
    return size === 2 ? ramHex(addr) : `${ramHex(addr)}.b`;
}

export { bit };
