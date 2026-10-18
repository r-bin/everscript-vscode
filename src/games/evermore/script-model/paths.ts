// Ownership: the paths through one script — every way control can go from its entry, with calls
// to local scripts run inline (a call by global id is a step: those are the shared drivers). Pure.
//
// What a script stages for a call only travels along one path (knowledge ram/7e2461: in $98:CCCC
// one branch stages a bonus and ends, the other is another pickup), so loot and doors are read
// per path, not from the listing.

import { DecodeError, Fact, Instruction, ScriptRom, decodeAt, facts } from '../script-vm';

export interface Step {
    ins: Instruction;
    fact: Fact;
    /** 0 in the script itself, 1+ inside an inlined call. */
    depth: number;
}

export interface Paths {
    paths: Step[][];
    /** More paths than the limit, a decode error or a loop cut some short. */
    truncated: boolean;
}

const MAX_PATHS = 256;
const MAX_STEPS = 4000;
const MAX_DEPTH = 4;

interface Cursor { pc: number; ret: number[]; steps: Step[]; seen: Set<string> }

export function paths(rom: ScriptRom, entry: number): Paths {
    const out: Step[][] = [];
    let truncated = false;
    let budget = MAX_STEPS * 4;
    const todo: Cursor[] = [{ pc: entry, ret: [], steps: [], seen: new Set() }];
    while (todo.length) {
        if (out.length >= MAX_PATHS) { truncated = true; break; }
        const c = todo.pop()!;
        for (;;) {
            if (--budget < 0 || c.steps.length >= MAX_STEPS) { truncated = true; out.push(c.steps); break; }
            // A loop: the path has been here, inside the same calls, before. (The same helper called
            // twice from one script is not a loop: its return addresses differ.)
            const key = c.ret.length ? `${c.pc}:${c.ret.join(':')}` : String(c.pc);
            if (c.seen.has(key)) { out.push(c.steps); break; }
            c.seen.add(key);
            let ins: Instruction;
            try { ins = decodeAt(rom, c.pc); }
            catch (e) { if (e instanceof DecodeError) { truncated = true; out.push(c.steps); break; } throw e; }
            const fact = facts(ins);
            c.steps.push({ ins, fact, depth: c.ret.length });
            if (ins.flow === 'end' || ins.flow === 'reset') {
                if (ins.opcode === 0x00 && c.ret.length) { c.pc = c.ret.pop()!; continue; }
                out.push(c.steps);
                break;
            }
            if (ins.flow === 'jump') { c.pc = ins.target!; continue; }
            if (ins.flow === 'branch') {
                if (ins.target !== null) todo.push({ pc: ins.target, ret: [...c.ret], steps: [...c.steps], seen: new Set(c.seen) });
                c.pc = ins.next;
                continue;
            }
            if (fact.k === 'call' && fact.global === null && ins.target !== null && c.ret.length < MAX_DEPTH && rom.contains(ins.target)) {
                c.ret.push(ins.next);
                c.pc = ins.target;
                continue;
            }
            c.pc = ins.next;
        }
    }
    return { paths: out, truncated };
}
