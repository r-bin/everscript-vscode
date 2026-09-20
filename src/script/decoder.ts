// Ownership: walk a script from its entry point into instructions. Pure.
//
// Ported from SoEScriptDumper/list-rooms.cpp. The decoder's one hard
// requirement is that it never guesses a length: an instruction whose layout
// is not verified stops the walk, because a wrong size turns every following
// byte into noise and the output silently becomes fiction.

import { read8, snesToRom, u8 } from './addressing';
import { OperandStack, parseExpression, Expression } from './expression';
import {
    OPCODE_LAYOUTS, OPCODE_STEPS, TERMINAL_OPCODES, UNRESOLVED, UPSTREAM_UNKNOWN,
    writeValueIsInline, OperandStep,
} from './opcodes';

export interface DecodedInstruction {
    /** SNES address of the opcode byte. */
    address: number;
    opcode: number;
    /** Total length in bytes. */
    size: number;
    /** Operand expressions, in order. */
    operands: Expression[];
    /** True for END and friends. */
    terminal: boolean;
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
    /** Set when the walk stopped on something the table does not cover. */
    stoppedAt: number | null;
}

const MAX_BYTES = 0x2000;
const MAX_INSTRUCTIONS = 4096;

/** Decode the single instruction at `address`, or null if its size is unknown. */
export function decodeInstruction(
    rom: Uint8Array,
    address: number,
    stack: OperandStack,
): DecodedInstruction | null {
    if (snesToRom(address) >= rom.length) return null;
    const opcode = read8(rom, address);
    const steps = stepsFor(opcode);
    if (!steps) return null;

    let p = address + 1;
    const operands: Expression[] = [];
    for (const step of steps) {
        if (step.kind === 'bytes') { p += step.n; continue; }
        if (step.kind === 'expr') {
            const e = parseExpression(rom, p, stack);
            operands.push(e);
            p += e.length;
            if (!e.ok) return { address, opcode, size: p - address, operands, terminal: false };
            continue;
        }
        // writeValue: a type byte that is either the value, a literal
        // announcement, or the start of an expression.
        const type = read8(rom, p);
        if (writeValueIsInline(type)) { p += 1; continue; }
        if (type === 0x82) { p += 2; continue; }
        if (type === 0x84) { p += 3; continue; }
        const e = parseExpression(rom, p, stack);
        operands.push(e);
        p += e.length;
        if (!e.ok) return { address, opcode, size: p - address, operands, terminal: false };
    }

    return {
        address,
        opcode,
        size: p - address,
        operands,
        terminal: TERMINAL_OPCODES.has(opcode),
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
 * The operand program for an opcode: the hand-ported one if it has a shape a
 * flat layout cannot describe, otherwise the measured layout expanded.
 */
function stepsFor(opcode: number): readonly OperandStep[] | null {
    const explicit = OPCODE_STEPS[opcode];
    if (explicit) return explicit;
    const flat = OPCODE_LAYOUTS[opcode];
    if (!flat) return null;
    const [prefix, exprCount, suffix] = flat;
    const steps: OperandStep[] = [];
    if (prefix) steps.push({ kind: 'bytes', n: prefix });
    for (let i = 0; i < exprCount; i++) steps.push({ kind: 'expr' });
    if (suffix) steps.push({ kind: 'bytes', n: suffix });
    return steps;
}

/** Why the decoder cannot get past this opcode. */
export function unresolvedNote(opcode: number): string {
    if (UPSTREAM_UNKNOWN.has(opcode)) return 'SoEScriptDumper cannot decode this one either';
    return UNRESOLVED[opcode] || 'not seen in the vanilla ROM';
}

/** `0x1f` — for messages. */
export function opcodeHex(opcode: number): string {
    return u8(opcode);
}
