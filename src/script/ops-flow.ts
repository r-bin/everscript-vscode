// Ownership: control flow — END, branches, conditionals, calls, sleep.
//
// Ported case-for-case from the main switch in SoEScriptDumper/list-rooms.cpp
// (line 1098 onward). Wording is kept identical to the dumper's, including
// its quirks, because `npm run check:script` scores these strings against its
// own output; a "nicer" phrasing here is indistinguishable from a wrong one.

import { read16, read24, ramAddr, scriptValueToSnes, u8, u16, SCRIPTS_START_ADDR_US } from './addressing';
import { Cursor, OpResult, done, target } from './cursor';
import { absScriptName, globalScriptName, npcScriptName, ramAddrToStr, ramBitToStr, currencyName } from './names';

/** `SKIP 8 (to 0x94e60d)` — the tail every branch shares. */
function skip(jmp: number, dst: number): string {
    return `SKIP ${jmp} (to ${target(dst)})`;
}

/**
 * The conditional branch pair, 0x08 (branch if true) and 0x09 (branch if
 * false).
 *
 * Upstream special-cases seven shapes before falling back to the generic
 * expression parser, purely for readability — a bit test reads far better as
 * `IF $22f1&0x40 (Got the Diamond Eyes)` than as the equivalent expression
 * tree. The shapes are recognised by looking ahead at the operand bytes.
 */
function branchIf(c: Cursor, condition: boolean): OpResult {
    const type = c.u8();

    if (type === 0xd7) {
        const b = c.branch16();
        return done(c, `IF controlled char ${condition ? '==' : '!='} dog ${skip(b.jmp, b.target)}`);
    }

    // Two shapes the randomizer emits to hard-wire a branch on or off.
    if ((type & 0xf0) === 0x30 && c.peek(0) === 0x14 && c.peek(1) === 0x14 && c.peek(2) === 0x94) {
        c.addr += 3;
        const b = c.branch16();
        const sense = (!condition) !== (type !== 0x30) ? 'FALSE (never)' : 'TRUE (always)';
        return done(c, `IF !!!FALSE == ${sense} ${skip(b.jmp, b.target)}`);
    }
    if ((type & 0xf0) === 0x30 && c.peek(0) === 0x14 && c.peek(1) === 0x94) {
        c.addr += 2;
        const b = c.branch16();
        const sense = (!condition) !== (type !== 0x30) ? 'FALSE (always)' : 'TRUE (never)';
        return done(c, `IF !!FALSE == ${sense} ${skip(b.jmp, b.target)}`);
    }

    // `IF (a OR b)` written as the De Morgan equivalent, in one Traxx script.
    if (!condition && type === 0x05 && c.peek(2) === 0x14 && c.peek(3) === 0x29 &&
        c.peek(4) === 0x05 && c.peek(7) === 0x14 && c.peek(8) === 0xa8) {
        const w1 = read16(c.rom, c.addr);
        const a1 = 0x2258 + (w1 >> 3);
        const w2 = read16(c.rom, c.addr + 5);
        const a2 = 0x2258 + (w2 >> 3);
        const jmp = (read16(c.rom, c.addr + 9) << 16) >> 16;
        c.addr += 11;
        const dst = (c.addr + jmp) >>> 0;
        return done(c, `IF ((${ramAddr(a1)}&${u8(1 << (w1 & 7))}) OR (${ramAddr(a2)}&${u8(1 << (w2 & 7))})) ${skip(jmp, dst)}`);
    }

    // The common case by far: test one flag bit and branch.
    if (type === 0x85 || (type === 0x05 && c.peek(2) === 0x94)) {
        const invert = (!condition) !== (type === 0x05);
        const word = c.u16();
        if (type === 0x05) c.addr += 1; // the 0x94 that inverts it
        const b = c.branch16();
        const addr = 0x2258 + (word >> 3);
        const readable = ramBitToStr(addr, word & 7);
        const not = invert && readable ? 'NOT' : '';
        return done(c, `IF ${invert ? '!(' : ''}${ramAddr(addr)}&${u8(1 << (word & 7))}${invert ? ')' : ''} ${not}${readable}${skip(b.jmp, b.target)}`);
    }

    // One sniff spot combines a flag test with a byte compare.
    if (type === 0x05 && c.peek(2) === 0x29 && c.peek(3) === 0x08 && c.peek(6) === 0x29 &&
        c.peek(7) === 0x32 && c.peek(8) === 0x22 && c.peek(9) === 0xa8) {
        const word = c.u16();
        c.addr += 2;                       // 0x29 0x08
        const addr2 = 0x2258 + c.u16();
        c.addr += 1;                       // 0x29
        const val2 = c.u8() & 0x0f;
        c.addr += 2;                       // 0x22 0xa8
        const b = c.branch16();
        const addr = 0x2258 + (word >> 3);
        const readable = ramBitToStr(addr, word & 7);
        // Upstream tests its sub-instruction byte rather than the opcode here,
        // so these negations never print. Kept, so the text matches.
        return done(c, `IF ${ramAddr(addr)} & ${u8(1 << (word & 7))} ${readable}&& ${ramAddr(addr2)}==${u8(val2)} ${skip(b.jmp, b.target)}`);
    }

    // Test a whole word against zero.
    if (type === 0x88) {
        const addr = 0x2258 + c.u16();
        const b = c.branch16();
        return done(c, `IF ${ramAddrToStr(addr)} ${condition ? '!=' : '=='} 0x00 ${skip(b.jmp, b.target)}`);
    }

    c.back();
    const e = c.exprEx();
    const open = condition || e.weight < 2 ? '' : '(';
    const close = condition || e.weight < 2 ? '' : ')';
    const sense = condition ? '' : ' == FALSE';
    if (!c.ok) return done(c, `IF ${open}${e.text}${close}${sense} THEN SKIP ...?`);
    const b = c.branch16();
    return done(c, `IF ${open}${e.text}${close}${sense} THEN ${skip(b.jmp, b.target)}`);
}

/**
 * The CALL-with-arguments family: a count, that many expression arguments,
 * then a script reference whose width depends on the opcode.
 *
 * This is the shape a flat "n fixed bytes, m expressions, n fixed bytes"
 * layout cannot describe, and getting it wrong is what produced instructions
 * hundreds of bytes long in the previous decoder.
 */
function callWithArgs(c: Cursor, instr: number): OpResult {
    const n = c.u8();
    const args: string[] = [];
    for (let i = 0; i < n; i++) {
        args.push(c.expr());
        if (!c.ok) break;
    }
    if (!c.ok) return done(c, `WRITE TO ARGS from ${n} sub-instrs: ${args.join(', ')} and CALL ...?`);

    let addr: number;
    let kind: string;
    let name: string;
    if (instr === 0xb0) {
        addr = c.u8();
        kind = 'Global (8bit)';
        name = globalScriptName(addr);
    } else if (instr === 0xb1) {
        addr = c.u16();
        kind = 'Short/NPC (16bit)';
        name = npcScriptName(addr);
    } else if (instr === 0xb2) {
        addr = (c.start - 0x100 + c.u8()) >>> 0;
        if (!(addr & 0x8000)) addr = (addr - 0x8000) >>> 0;
        kind = 'Relative (8bit)';
        name = absScriptName(addr);
    } else if (instr === 0xb3) {
        addr = (c.start - 0x10000 + c.u16()) >>> 0;
        if (!(addr & 0x8000)) addr = (addr - 0x8000) >>> 0;
        kind = 'Relative (16bit)';
        name = absScriptName(addr);
    } else {
        addr = scriptValueToSnes(c.u24());
        kind = 'Absolute (24bit)';
        name = absScriptName(addr);
    }
    const hex = (addr >>> 0).toString(16).padStart(2, '0');
    return done(c, `CALL ${kind} script 0x${hex} ("${name}") WITH ${n} ARGS ${args.join(', ')}`);
}

/** Decode one control-flow opcode, or null if this module does not own it. */
export function flowOp(c: Cursor, instr: number): OpResult | null {
    switch (instr) {
        case 0x00:
            return done(c, 'END (return)', { terminal: true });

        case 0x04: {
            const b = c.branch16();
            return done(c, skip(b.jmp, b.target));
        }
        case 0x05: {
            // An 8-bit displacement that is always negative.
            const jmp = c.u8() - 0x100;
            return done(c, skip(jmp, (c.start + jmp) >>> 0));
        }

        case 0x07:
        case 0x29: {
            const addr = scriptValueToSnes(c.u24());
            return done(c, `CALL ${target(addr)} ${absScriptName(addr)}`);
        }

        case 0x08: return branchIf(c, true);
        case 0x09: return branchIf(c, false);

        case 0x0a:
        case 0x0b: {
            const op = instr === 0x0a ? '>=' : '<';
            const currency = currencyName(c.expr());
            const v = c.u24();
            const b = c.branch16();
            if (!c.ok) return done(c, `IF ${currency} (moniez) ${op} ...? THEN SKIP ...?`);
            return done(c, `IF ${currency} (moniez) ${op} ${v} THEN ${skip(b.jmp, b.target)}`);
        }
        case 0x8e:
        case 0x8f: {
            const op = instr === 0x8e ? '>=' : '<';
            const currency = currencyName(c.expr());
            const v = c.expr();
            const b = c.branch16();
            if (!c.ok) return done(c, `IF ${currency} (moniez) ${op} ...? THEN SKIP ...?`);
            return done(c, `IF ${currency} (moniez) ${op} ${v} THEN ${skip(b.jmp, b.target)}`);
        }

        case 0x38:
        case 0x3a:
            return done(c, 'YIELD (break out of script loop, continue later)');

        case 0x39:
        case 0x3b:
            return done(c, `SLEEP ${c.expr()} TICKS`);

        case 0xa3: {
            const id = c.u8();
            return done(c, `CALL "${globalScriptName(id)}" (${u8(id)})`);
        }
        case 0xa4: {
            const id = c.u16();
            const table = SCRIPTS_START_ADDR_US + read16(c.rom, SCRIPTS_START_ADDR_US);
            const dst = scriptValueToSnes(read24(c.rom, table + id));
            return done(c, `CALL ${u16(id)} -> ${target(dst)}`);
        }
        case 0xa5: {
            const off = c.u8() - 0x100;
            let dst = (c.start + off) >>> 0;
            if (!(dst & 0x8000)) dst = (dst - 0x8000) >>> 0;
            return done(c, `RCALL ${off} (to ${target(dst)}): ${absScriptName(dst, 'Unknown')}`);
        }
        case 0xa6: {
            const off = c.s16();
            let dst = (c.start + off) >>> 0;
            if (!(dst & 0x8000)) dst = (dst + (off < 0 ? -0x8000 : 0x8000)) >>> 0;
            return done(c, `RCALL ${String(off).padStart(4, ' ')} (to ${target(dst)}): ${absScriptName(dst, 'Unknown')}`);
        }

        case 0xa7:
        case 0xa8: {
            const ticks = instr === 0xa7 ? c.u8() : c.u16();
            return done(c, `SLEEP ${ticks - 1} TICKS`);
        }

        case 0xab:
            // Upstream stops here too: the script cannot continue past a reset.
            return done(c, 'Reset game', { terminal: true });

        case 0xaf:
        case 0xb0:
        case 0xb1:
        case 0xb2:
        case 0xb3:
        case 0xb4:
            return callWithArgs(c, instr);

        default:
            return null;
    }
}
