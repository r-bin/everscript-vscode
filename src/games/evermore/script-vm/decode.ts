// Ownership: one script instruction — its operands, its length and where control can go after
// it, read by the rules of spec.ts. Pure. Never guesses: an opcode the game has no handler for,
// or an operand the game cannot evaluate, is a DecodeError with its address.

import { advance, distance, pack, unpack, ScriptRom } from './address';
import { Expression, ExpressionError, constantValue, readExpression } from './expression';
import { Flow, OPCODES, OpcodeSpec, OperandToken } from './spec';
import { hexLower } from '../../../platform/hex';

export type Operand =
    | { k: 'u8' | 'u16' | 'skip'; value: number }
    | { k: 'u24'; value: number; target: number }
    | { k: 'E'; expr: Expression }
    | { k: 'A'; args: Expression[] }
    | { k: 'Z'; list: Expression[] }
    | { k: 'r16' | 'rb' | 'cb' | 'c16'; value: number; target: number };

export interface Instruction {
    address: number;
    opcode: number;
    spec: OpcodeSpec;
    size: number;
    operands: Operand[];
    /** Address of the instruction that follows in the byte stream. */
    next: number;
    /** Jump target (jump, branch) or the script a call / start / id names. */
    target: number | null;
    flow: Flow;
}

export class DecodeError extends Error {
    constructor(message: string, readonly address: number) { super(message); }
}

/** Calls and starts that name their script by id or table offset instead of a pointer. */
const BY_GLOBAL_ID = new Set([0xA3, 0xB0]);
const BY_TRIGGER_OFFSET = new Set([0xA4, 0xB1]);
/** Expression lists (Z) longer than this are taken for a misread. */
const MAX_LIST = 64;

export function decodeAt(rom: ScriptRom, at: number): Instruction {
    if (!rom.contains(at)) throw new DecodeError('not script space', at);
    const opcode = rom.u8(at);
    const spec = OPCODES.get(opcode);
    if (!spec) throw new DecodeError(`opcode $${hex2(opcode)} has no handler (the CPU stops)`, at);
    let p = advance(at, 1);
    const operands: Operand[] = [];
    let target: number | null = null;
    const expr = (): Expression => {
        try { const e = readExpression(rom, p); p = advance(p, e.size); return e; }
        catch (e) { if (e instanceof ExpressionError) throw new DecodeError(e.message, e.address); throw e; }
    };
    for (const tok of spec.operands as readonly OperandToken[]) {
        switch (tok) {
            case 'u8': case 'skip': operands.push({ k: tok, value: rom.u8(p) }); p = advance(p, 1); break;
            case 'u16': operands.push({ k: 'u16', value: rom.u16(p) }); p = advance(p, 2); break;
            case 'u24': { const v = rom.u24(p); p = advance(p, 3); target = unpack(v); operands.push({ k: 'u24', value: v, target }); break; }
            case 'E': operands.push({ k: 'E', expr: expr() }); break;
            case 'A': {
                const n = rom.u8(p);
                if (n === 0) throw new DecodeError('argument count 0 (the handler would loop 65536 times)', p);
                p = advance(p, 1);
                const args: Expression[] = [];
                for (let k = 0; k < n; k++) args.push(expr());
                operands.push({ k: 'A', args });
                break;
            }
            case 'Z': {
                const list: Expression[] = [];
                for (;;) {
                    const e = expr();
                    list.push(e);
                    if (constantValue(e) === 0) break;
                    if (list.length > MAX_LIST) throw new DecodeError('expression list without a 0', at);
                }
                operands.push({ k: 'Z', list });
                break;
            }
            case 'r16': {
                const w = rom.u16(p); p = advance(p, 2);
                target = unpack(pack(p) + ((w << 16) >> 16));
                operands.push({ k: 'r16', value: w, target });
                break;
            }
            case 'rb': case 'cb': {
                const b = rom.u8(p); p = advance(p, 1);
                target = unpack(pack(at) + b - 0x100);
                operands.push({ k: tok, value: b, target });
                break;
            }
            case 'c16': {
                const w = rom.u16(p); p = advance(p, 2);
                target = unpack(pack(at) + w - 0x10000);
                operands.push({ k: 'c16', value: w, target });
                break;
            }
        }
    }
    const last = operands[operands.length - 1];
    if (BY_GLOBAL_ID.has(opcode) && last && last.k === 'u8') target = rom.globalScript(last.value);
    if (BY_TRIGGER_OFFSET.has(opcode) && last && last.k === 'u16') target = rom.triggerScript(last.value);
    return { address: at, opcode, spec, size: distance(at, p), operands, next: p, target, flow: spec.flow };
}

/** The addresses control can reach after `ins` in the same script (calls and starts not followed). */
export function successors(ins: Instruction): number[] {
    switch (ins.flow) {
        case 'end': case 'reset': return [];
        case 'jump': return ins.target === null ? [] : [ins.target];
        case 'branch': return ins.target === null ? [ins.next] : [ins.next, ins.target];
        default: return [ins.next];
    }
}

/** The script a call or start runs, when the instruction names one. */
export function callee(ins: Instruction): number | null {
    return ins.flow === 'call' || ins.flow === 'start' ? ins.target : null;
}

const hex2 = (v: number): string => hexLower(v, 2);
