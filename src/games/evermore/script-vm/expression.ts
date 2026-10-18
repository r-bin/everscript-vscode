// Ownership: script expressions — reading one from script bytes, and its value tree. Pure.
//
// An expression is a run of bytes evaluated by $8C:EA43: the low 7 bits of each byte pick a
// sub-op (spec.ts SUB_OPS) that may read 1 or 2 immediate bytes; bit 7 marks the last byte.
// Values are 32-bit (DP $02/$04). Operands come in postfix order: a binary operator pops the
// value an earlier `push` (0x29) saved and combines it with the current one, so `a + b` is
// `a, push, b, +`. Sub-op 0x00 returns at once, whatever bit 7 says.

import { advance, distance, ScriptRom } from './address';
import { SUB_OPS, SubOpSpec, smallConstant } from './spec';

export interface Term {
    subOp: number;
    spec: SubOpSpec;
    /** The immediate operand, when the sub-op has one. */
    value?: number;
}

/** A value tree rebuilt from the postfix terms (for printing and for constant folding). */
export type Node =
    | { k: 'const'; value: number }
    | { k: 'read'; term: Term }
    | { k: 'value'; term: Term }
    | { k: 'unary'; op: string; arg: Node }
    | { k: 'binary'; op: string; left: Node; right: Node }
    | { k: 'unknown' };

export interface Expression {
    address: number;
    size: number;
    terms: Term[];
}

export class ExpressionError extends Error {
    constructor(message: string, readonly address: number) { super(message); }
}

/** Read the expression that starts at `at`. Throws ExpressionError on a sub-op the game cannot run. */
export function readExpression(rom: ScriptRom, at: number): Expression {
    const terms: Term[] = [];
    let p = at;
    for (let guard = 0; guard < 256; guard++) {
        const byte = rom.u8(p);
        const subOp = byte & 0x7F;
        const spec = SUB_OPS.get(subOp);
        if (!spec) throw new ExpressionError(`sub-op $${subOp.toString(16).padStart(2, '0')} does not exist`, p);
        p = advance(p, 1);
        const term: Term = { subOp, spec };
        if (spec.size === 1) { term.value = rom.u8(p); p = advance(p, 1); }
        else if (spec.size === 2) { term.value = rom.u16(p); p = advance(p, 2); }
        terms.push(term);
        if ((byte & 0x80) || subOp === 0x00) return { address: at, size: distance(at, p), terms };
    }
    throw new ExpressionError('expression longer than 256 bytes', at);
}

/** The value tree, or `unknown` where the postfix order does not balance (the game would read stale values). */
export function tree(e: Expression): Node {
    const stack: Node[] = [];
    let cur: Node = { k: 'unknown' };
    for (const t of e.terms) {
        const s = t.spec;
        switch (s.kind) {
            case 'end': break;
            case 'const': {
                const small = smallConstant(t.subOp);
                cur = { k: 'const', value: small !== null ? small : signedConst(t) };
                break;
            }
            case 'read': case 'flag': cur = { k: 'read', term: t }; break;
            case 'value': cur = { k: 'value', term: t }; break;
            case 'unary': cur = { k: 'unary', op: s.name, arg: cur }; break;
            case 'push': stack.push(cur); break;
            case 'binary': cur = { k: 'binary', op: s.name, left: stack.pop() ?? { k: 'unknown' }, right: cur }; break;
        }
    }
    return cur;
}

function signedConst(t: Term): number {
    const v = t.value ?? 0;
    if (t.subOp === 0x01) return (v | 0xFF00) - 0x10000;          // the handler ORs in $FF00 and sets the high word
    if (t.subOp === 0x03) return v - 0x10000;                     // high word $FFFF
    return v;
}

/** The constant an expression always evaluates to, when it is one plain constant. */
export function constantValue(e: Expression): number | null {
    const n = tree(e);
    return n.k === 'const' ? n.value : null;
}
