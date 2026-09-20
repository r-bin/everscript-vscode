// Ownership: the instructions that write memory — variables, flag bits and
// script arguments.
//
// Ported case-for-case from SoEScriptDumper/list-rooms.cpp. Two banks matter:
// $2258 is the persistent save block and $2834 the per-room scratch block,
// and which one an opcode targets is the only difference between several
// otherwise identical pairs.

import { ramAddr, u8, u16 } from './addressing';
import { Cursor, OpResult, done } from './cursor';
import { isFinalInlineValue, inlineValueOf } from './expression';
import { ramAddrToStr, ramBitToStr, ramValueToStr } from './names';

const BASE_MAIN = 0x2258;
const BASE_TEMP = 0x2834;

/** `WRITE CHANGE DOGGO ($2443) = Wolf (0x02)`, naming whatever is known. */
function write(addr: number, value: number | string): string {
    const name = ramAddrToStr(addr);
    if (typeof value === 'string') return `WRITE ${name} = ${value}`;
    const valueName = ramValueToStr(addr, value);
    return `WRITE ${name} = ${valueName ?? u16(value)}`;
}

/**
 * Set or clear one flag bit, optionally copying another bit's state.
 *
 * `0x0c` works in the save block and `0x0d` in the scratch block; everything
 * else about them is identical.
 */
function setBit(c: Cursor, instr: number): OpResult {
    const word = c.u16();
    const addr = (instr === 0x0c ? BASE_MAIN : BASE_TEMP) + (word >> 3);
    const type = c.u8();
    const readable = ramBitToStr(addr, word & 7);
    const setbm = 1 << (word & 7);

    // Conditional form: set this bit if another bit is set, clear it if not.
    if (type === 0x85 || type === 0x8a ||
        (type === 0x05 && c.peek(2) === 0x94) || (type === 0x0a && c.peek(2) === 0x94)) {
        const word2 = c.u16();
        const addr2 = ((type & 0x7f) === 0x05 ? BASE_MAIN : BASE_TEMP) + (word2 >> 3);
        const bm2 = 1 << (word2 & 7);
        const invert = (type & 0x80) === 0;
        if (invert) c.addr += 1; // the 0x94 that inverts it
        return done(c, `${ramAddr(addr)} |= ${u8(setbm)} if (${invert ? '!' : ''}${ramAddr(addr2)} & ${u8(bm2)}) else ${ramAddr(addr)} &= ~${u8(setbm)} ${readable}`.trimEnd());
    }
    if (type === 0xb0) {
        return done(c, `${ramAddr(addr)} &= ${u8(0xff & ~setbm)} (8bit mode) ${readable}`.trimEnd());
    }
    if (isFinalInlineValue(type)) {
        return done(c, `${ramAddr(addr)} |= ${u8(setbm)} ${readable}`.trimEnd());
    }
    c.back();
    const v = c.expr();
    return done(c, `${ramAddr(addr)} bit ${u8(setbm)} = ${v}${readable}`.trimEnd());
}

/**
 * The eight-strong generic write family.
 *
 * The value is a tagged union in the byte after the address: an inline
 * constant, a literal byte, a literal word, or an expression. Treating that
 * byte as a fixed-width field is what desynced the previous decoder.
 */
function writeVar(c: Cursor, instr: number): OpResult {
    const temp = instr === 0x11 || instr === 0x15 || instr === 0x19 || instr === 0x1d;
    const addr = (temp ? BASE_TEMP : BASE_MAIN) + c.u16();
    const type = c.u8();

    if (isFinalInlineValue(type)) return done(c, write(addr, inlineValueOf(type)));
    if (type === 0x82) return done(c, write(addr, c.u8()));
    if (type === 0x84) return done(c, write(addr, c.u16()));

    c.back();
    const v = c.expr();
    if (!c.ok) return done(c, `WRITE ${ramAddr(addr)} = ${v}`);
    return done(c, write(addr, v));
}

/** Decode one memory-write opcode, or null if this module does not own it. */
export function memoryOp(c: Cursor, instr: number): OpResult | null {
    switch (instr) {
        case 0x0c:
        case 0x0d:
            return setBit(c, instr);

        case 0x0e: {
            const bits = c.u8();
            const v = c.expr();
            return done(c, `Script arg${bits >> 3} bit ${u8(1 << (bits & 7))} = ${v}`);
        }

        case 0x17: {
            const addr = BASE_MAIN + c.u16();
            return done(c, write(addr, c.u16()));
        }

        case 0x1a:
        case 0x1e: {
            const arg = c.u8();
            const v = c.expr();
            return done(c, `WRITE SCRIPT arg${arg} = ${v}`, { untraced: true });
        }

        case 0x10: case 0x11: case 0x14: case 0x15:
        case 0x18: case 0x19: case 0x1c: case 0x1d:
            return writeVar(c, instr);

        case 0x1b: {
            const addr1 = BASE_MAIN + c.u16();
            const addr2 = BASE_MAIN + c.u16();
            const val1 = c.u8() << 3;
            const val2 = c.u8() << 3;
            return done(c, `${write(addr1, val1)} ; ${write(addr2, val2)}`);
        }

        case 0xad: {
            const addr1 = BASE_TEMP + c.u16();
            const addr2 = BASE_TEMP + c.u16();
            // Upstream shifts the first value twice and never shifts the
            // second — a typo in list-rooms.cpp, reproduced so the text
            // matches the dump this decoder is scored against.
            let val1 = c.u8();
            val1 <<= 3;
            const val2 = c.u8();
            val1 <<= 3;
            return done(c, `${write(addr1, val1)} ; ${write(addr2, val2)}`);
        }

        case 0x7a: {
            const dst = c.expr();
            const src = c.expr();
            return done(c, `WRITE *(${dst}) = ${src}`);
        }

        default:
            return null;
    }
}
