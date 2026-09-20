// Ownership: the NPCs a script can place, read out of the script. Pure.
//
// Three opcodes place an NPC, and they disagree about how:
//
//   0x3c  Load NPC <addr>>>1, flags/state <word>, at <x> <y>
//   0xba  LOAD NPC <id> at <x> <y>
//   0xa2  SPAWN NPC <addr>>>1, flags, x: <expr>, y: <expr>
//
// The first two carry literal positions; the third computes them, so it
// reports that something spawns without claiming where.
//
// **These are candidates, not a room's contents.** A room's enter script
// branches on save state — the same room is reused with different enemies
// depending on story progress — and this walks every branch. Deciding which
// branch actually runs needs a simulated WRAM, which does not exist yet; see
// docs/room-simulation.md.
//
// Two things are deliberately *not* claimed here, because neither has been
// established and a wrong answer is worse than an absent one:
//
//   - **What the NPC index means.** It is not a character-table index: the
//     jungle spawns index 15, and the Wimpy Flower that appears there is
//     character 109. The indirection has not been found.
//   - **What the coordinates mean.** They do not fit the trigger grid's
//     `(x - offX) * 2` mapping, and at least two other readings fit the
//     observed range equally well. So they are reported raw.

import { DecodedInstruction } from './decoder';

export interface SpawnFacts {
    /** NPC index as the opcode gives it — see the caveat above. */
    npc: number;
    /** Flags/state word, when the opcode carries one. */
    state: number | null;
    /** Raw position bytes, or null when the script computes them. */
    x: number | null;
    y: number | null;
    /** Which opcode placed it. */
    opcode: number;
}

/** Every NPC placement a script can reach, in walk order. */
export function extractSpawns(instructions: readonly DecodedInstruction[]): SpawnFacts[] {
    const out: SpawnFacts[] = [];
    for (const ins of instructions) {
        for (const e of ins.effects) {
            if (e.kind !== 'spawn') continue;
            out.push({ npc: e.npc, state: e.state, x: e.x, y: e.y, opcode: e.opcode });
        }
    }
    return out;
}
