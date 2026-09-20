// Ownership: the read head one instruction's operands are consumed through.
//
// The reference decoder is a 1600-line switch written against a raw
// `scriptaddr` that each case advances by hand, with `parse_sub(scriptaddr,
// &ok)` threaded through for expression operands. Porting that shape directly
// keeps the cases diffable against the C++, which matters far more here than
// elegance would: the whole value of this code is that it agrees with a
// reference nobody can re-derive.
//
// So this is that raw pointer with a name. `expr()` mirrors the
// `ok ? parse_sub(...) : "?"` idiom exactly, including that once one operand
// fails every later one renders as `?` and nothing more is read.

import { read8, read16, read24 } from './addressing';
import { Expression, OperandStack, parseExpression } from './expression';

export class Cursor {
    /** Read position, just past whatever has been consumed so far. */
    addr: number;
    /** False once an operand failed to parse; the walk must stop. */
    ok = true;
    /** Expression operands in order, for callers that want structure. */
    readonly operands: Expression[] = [];

    constructor(
        readonly rom: Uint8Array,
        /** SNES address of the opcode byte. */
        readonly start: number,
        private readonly stack: OperandStack,
    ) {
        this.addr = start + 1;
    }

    u8(): number { const v = read8(this.rom, this.addr); this.addr += 1; return v; }
    u16(): number { const v = read16(this.rom, this.addr); this.addr += 2; return v; }
    u24(): number { const v = read24(this.rom, this.addr); this.addr += 3; return v; }

    /** 16-bit two's complement, which is how branch offsets are stored. */
    s16(): number { const v = this.u16(); return v & 0x8000 ? v - 0x10000 : v; }

    /** Look ahead without consuming. Several cases disambiguate this way. */
    peek(offset = 0): number { return read8(this.rom, this.addr + offset); }

    /** Step back over a byte already consumed, to re-read it as an expression. */
    back(n = 1): void { this.addr -= n; }

    /**
     * One operand expression. Returns `?` without reading anything once a
     * previous operand has failed, so a case can chain several in a row
     * without a guard between each.
     */
    expr(): string {
        return this.exprEx().text;
    }

    /**
     * As `expr()`, but also gives the expression's weight — its rough token
     * count, which several cases use to decide whether to bracket it.
     */
    exprEx(): { text: string; weight: number } {
        if (!this.ok) return { text: '?', weight: 0 };
        const e = parseExpression(this.rom, this.addr, this.stack);
        this.operands.push(e);
        this.addr += e.length;
        if (!e.ok) this.ok = false;
        return { text: e.text, weight: e.weight };
    }

    /**
     * A relative branch: the 16-bit displacement and where it lands.
     *
     * Displacements are measured from the byte after the operand, so the
     * target is simply the post-read position plus the offset.
     */
    branch16(): { jmp: number; target: number } {
        const jmp = this.s16();
        return { jmp, target: (this.addr + jmp) >>> 0 };
    }

    /** Bytes consumed so far, including the opcode. */
    get size(): number { return this.addr - this.start; }
}

/** What one ported opcode case produces. */
export interface OpResult {
    /** The rendered summary, matching the dumper's wording. */
    text: string;
    /** SNES address just past this instruction. */
    next: number;
    /** False when an operand did not parse. */
    ok: boolean;
    /** True for END and the other instructions that finish a script. */
    terminal: boolean;
    operands: Expression[];
    /**
     * True when upstream marks the instruction "untraced": the length is
     * known and decoding continues, but what it does is a guess.
     */
    untraced: boolean;
}

/** Finish a case: everything the cursor read, plus the text it produced. */
export function done(
    c: Cursor,
    text: string,
    opts: { terminal?: boolean; untraced?: boolean } = {},
): OpResult {
    return {
        text,
        next: c.addr,
        ok: c.ok,
        terminal: opts.terminal === true,
        operands: c.operands,
        untraced: opts.untraced === true,
    };
}

/** `+x1f`-style script-relative offsets are not used; targets print absolute. */
export function target(addr: number): string {
    return '0x' + (addr >>> 0).toString(16).padStart(6, '0');
}
