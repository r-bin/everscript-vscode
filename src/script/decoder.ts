// Ownership: walk a script from its entry point into summarised instructions.
// Pure.
//
// Ported from SoEScriptDumper/list-rooms.cpp. The decoder's one hard
// requirement is that it never guesses a length: an instruction with no case
// in the reference stops the walk, because a wrong size turns every following
// byte into noise and the output silently becomes fiction.
//
// The per-opcode cases live in ops-flow / ops-memory / ops-entity /
// ops-system; this file only dispatches to them and drives the walk.

import { read8, snesToRom, u8 } from './addressing';
import { Expression, OperandStack } from './expression';
import { Cursor } from './cursor';
import { flowOp } from './ops-flow';
import { memoryOp } from './ops-memory';
import { entityOp } from './ops-entity';
import { systemOp } from './ops-system';

export interface DecodedInstruction {
    /** SNES address of the opcode byte. */
    address: number;
    opcode: number;
    /** Total length in bytes. */
    size: number;
    /** Human-readable rendering, in SoEScriptDumper's wording. */
    summary: string;
    /** Operand expressions, in order. */
    operands: Expression[];
    /** True for END and the other instructions a script cannot continue past. */
    terminal: boolean;
    /**
     * True when the reference knows the instruction's length but not reliably
     * what it does — the summary is a working guess, not a traced fact.
     */
    untraced: boolean;
}

/** Why the walk stopped. */
export type StopReason =
    | 'terminated'
    | 'unknown-opcode'
    | 'bad-operand'
    | 'out-of-rom'
    | 'max-bytes'
    | 'max-instructions';

export interface DecodedScript {
    address: number;
    instructions: DecodedInstruction[];
    stopReason: StopReason;
    /** Set when the walk stopped on something the decoder cannot get past. */
    stoppedAt: number | null;
}

const MAX_BYTES = 0x2000;
const MAX_INSTRUCTIONS = 4096;

/** Decode the single instruction at `address`, or null if it has no case. */
export function decodeInstruction(
    rom: Uint8Array,
    address: number,
    stack: OperandStack,
): DecodedInstruction | null {
    if (snesToRom(address) >= rom.length) return null;
    const opcode = read8(rom, address);
    const c = new Cursor(rom, address, stack);
    const res = flowOp(c, opcode) ?? memoryOp(c, opcode) ?? entityOp(c, opcode) ?? systemOp(c, opcode);
    if (!res) return null;
    return {
        address,
        opcode,
        size: res.next - address,
        summary: res.text,
        operands: res.operands,
        terminal: res.terminal,
        untraced: res.untraced,
    };
}

/**
 * Walk a script from `address` until it ends or the decoder runs out of
 * certainty.
 *
 * Stopping is a result, not a failure: `stopReason` and `stoppedAt` say
 * exactly where knowledge ran out, so a caller can show the instructions it
 * does have and be honest about the rest.
 */
export function decodeScript(rom: Uint8Array, address: number): DecodedScript {
    const instructions: DecodedInstruction[] = [];
    const stack = new OperandStack();
    let addr = address;
    let stopReason: StopReason = 'max-instructions';
    let stoppedAt: number | null = null;

    while (instructions.length < MAX_INSTRUCTIONS && addr - address < MAX_BYTES) {
        if (snesToRom(addr) >= rom.length) { stopReason = 'out-of-rom'; stoppedAt = addr; break; }
        const ins = decodeInstruction(rom, addr, stack);
        if (!ins) { stopReason = 'unknown-opcode'; stoppedAt = addr; break; }
        instructions.push(ins);
        if (ins.terminal) { stopReason = 'terminated'; break; }
        if (ins.operands.some((o) => !o.ok)) { stopReason = 'bad-operand'; stoppedAt = addr; break; }
        if (ins.size <= 0) { stopReason = 'unknown-opcode'; stoppedAt = addr; break; }
        addr += ins.size;
    }
    if (stopReason === 'max-instructions' && addr - address >= MAX_BYTES) stopReason = 'max-bytes';

    return { address, instructions, stopReason, stoppedAt };
}

/**
 * Why the decoder cannot get past this opcode.
 *
 * Every opcode the reference has a case for is ported, so anything that
 * reaches here is one the reference cannot decode either — it prints those in
 * red as UNKNOWN INSTR and stops for the same reason.
 */
export function unresolvedNote(opcode: number): string {
    return `${u8(opcode)}: SoEScriptDumper cannot decode this one either, so its length is unknown`;
}

/** `0x1f` — for messages. */
export function opcodeHex(opcode: number): string {
    return u8(opcode);
}
