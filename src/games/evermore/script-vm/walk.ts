// Ownership: static walks over script code — every instruction reachable from entry points,
// following jumps, both sides of each branch and the scripts calls and starts name. Pure.

import { ScriptRom } from './address';
import { DecodeError, Instruction, callee, decodeAt, successors } from './decode';

export interface Walk {
    /** Decoded instructions by address. */
    instructions: Map<number, Instruction>;
    /** Where decoding failed, by address. */
    errors: Map<number, string>;
    /** Script entry points reached through calls and starts, besides the given ones. */
    callees: Set<number>;
}

/** Walk from `entries`; `followCalls` false stays inside the scripts given. */
export function walk(rom: ScriptRom, entries: Iterable<number>, followCalls = true): Walk {
    const instructions = new Map<number, Instruction>();
    const errors = new Map<number, string>();
    const callees = new Set<number>();
    const todo = [...entries];
    while (todo.length) {
        const at = todo.pop()!;
        if (instructions.has(at) || errors.has(at)) continue;
        let ins: Instruction;
        try { ins = decodeAt(rom, at); }
        catch (e) { if (e instanceof DecodeError) { errors.set(at, e.address === at ? e.message : `${e.message} (at $${e.address.toString(16)})`); continue; } throw e; }
        instructions.set(at, ins);
        todo.push(...successors(ins));
        const c = callee(ins);
        if (c !== null && followCalls && rom.contains(c)) { callees.add(c); todo.push(c); }
    }
    return { instructions, errors, callees };
}

/** One script in byte order from `entry`, as far as control reaches inside it. */
export function scriptInstructions(rom: ScriptRom, entry: number): Instruction[] {
    return [...walk(rom, [entry], false).instructions.values()].sort((a, b) => a.address - b.address);
}
