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
import { Cursor, ScriptEffect } from './cursor';
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
    /** Structured side effects — what the instruction writes, tests or calls. */
    effects: ScriptEffect[];
    /**
     * A placeholder for a byte nothing can decode. The walk records it and
     * carries on at the next branch target instead of pretending the script
     * ended there.
     */
    undecodable: boolean;
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
    /** Addresses where decoding could not continue and the walk jumped on. */
    gaps: number[];
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
        effects: res.effects,
        undecodable: false,
    };
}

/** A row standing in for a byte that has no decoding. */
function undecodableAt(address: number, opcode: number): DecodedInstruction {
    return {
        address, opcode, size: 1,
        // Worded exactly as the reference's default case, so summary parity
        // stays a pure measurement. The explanation belongs in the UI, which
        // has `undecodable` and `unresolvedNote()` to build it from.
        summary: 'UNKNOWN INSTR',
        operands: [], terminal: false, untraced: false, effects: [], undecodable: true,
    };
}

/**
 * Walk a script from `address` into instructions.
 *
 * The walk is not linear, because scripts are not. A script ends at an END,
 * but an END is only the end of *one path* — code after a conditional lives
 * past it, reachable only via the branch. So every branch destination is
 * recorded, and on an END the walk resumes at the next one it has not
 * reached. Without this, a Dark Forest B-trigger reads as one sniff spot
 * instead of nine. That is the reference's behaviour, guards included.
 *
 * The same resumption applies to a byte nothing can decode: the walk notes it
 * in `gaps`, emits a placeholder row, and carries on at the next branch
 * target rather than pretending the script stopped. `stopReason` describes
 * only how the walk finally ran out.
 */
export function decodeScript(rom: Uint8Array, address: number): DecodedScript {
    const instructions: DecodedInstruction[] = [];
    const stack = new OperandStack();
    const pending = new Set<number>();
    const reached = new Set<number>();
    const gaps: number[] = [];
    let addr = address;
    let furthest = address;
    let stopReason: StopReason = 'max-instructions';
    let stoppedAt: number | null = null;

    /** The lowest recorded branch target still ahead of us, if any. */
    const resume = (from: number): number | null => {
        let best: number | null = null;
        for (const t of pending) {
            if (t <= from || reached.has(t)) continue;
            if (best === null || t < best) best = t;
        }
        return best;
    };

    while (instructions.length < MAX_INSTRUCTIONS && furthest - address < MAX_BYTES) {
        if (snesToRom(addr) >= rom.length) { stopReason = 'out-of-rom'; stoppedAt = addr; break; }
        reached.add(addr);
        if (addr > furthest) furthest = addr;

        const ins = decodeInstruction(rom, addr, stack);
        const bad = !ins || ins.size <= 0 || ins.operands.some((o) => !o.ok);

        if (ins) instructions.push(ins);
        if (ins) for (const e of ins.effects) if (e.kind === 'branch') pending.add(e.target);

        if (!bad && !ins!.terminal) { addr += ins!.size; continue; }

        // End of this path, one way or another: take the next branch target.
        if (bad) {
            gaps.push(addr);
            if (!ins) instructions.push(undecodableAt(addr, read8(rom, addr)));
        }
        const next = resume(addr);
        if (next !== null) { addr = next; continue; }
        if (!bad) stopReason = 'terminated';
        else { stopReason = ins ? 'bad-operand' : 'unknown-opcode'; stoppedAt = addr; }
        break;
    }
    if (stopReason === 'max-instructions' && furthest - address >= MAX_BYTES) stopReason = 'max-bytes';

    return { address, instructions, stopReason, stoppedAt, gaps };
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
