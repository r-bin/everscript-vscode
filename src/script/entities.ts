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
// A fourth places a spawner:
//
//   0xc2  Add NPC <id> spawner at <x>,<y>, count from $2433
//
// **The index is an `ENEMY` enum value**, which the encoder's `add_enemy`
// settles: it emits `enemy * 2` for the opcodes that store an address
// (0x3c, 0xa2) and the bare value for the others (0xba, 0xc2). Unshifting
// therefore lands back on the enum, whose own comments give the character
// record and the game's name — index 0x0b is `FLOWER_PURPLE`, character 109,
// "Wimpy Flower".
//
// **Coordinates are in the same space as a live room's `add_enemy(x, y)`**,
// because the encoder passes those arguments straight through for 0x3c and
// 0xba. That is 8-pixel units, which is also one SVG unit in the Rooms tab,
// so a ROM spawn and a source-defined enemy plot identically. (0xa2 instead
// multiplies by 8 and takes expressions, so it carries no literal position.)
//
// **These are still candidates, not a room's contents.** A room's enter
// script branches on save state — the same room is reused with different
// enemies as the story moves on — and this walks every branch. Deciding
// which branch actually runs needs a simulated WRAM; see
// docs/room-simulation.md.

import { DecodedInstruction } from './decoder';
import { enemyName } from './names';

/** Where the spawner count is staged before a spawner is placed. */
const ENEMY_SPAWNER_QUANTITY = 0x2433;

export interface SpawnFacts {
    /** `ENEMY` enum value. */
    npc: number;
    /** The Everscript constant, e.g. `FLOWER_PURPLE`. */
    name: string | null;
    /** The game's own name, e.g. `Wimpy Flower`. */
    romName: string | null;
    /** Its record in the character table at $8EB678. */
    character: number | null;
    /** Flags/state word, when the opcode carries one. */
    state: number | null;
    /** Position in SVG units, or null when the script computes it. */
    x: number | null;
    y: number | null;
    /** True for 0xc2, which places a spawner rather than one enemy. */
    spawner: boolean;
    /** How many the spawner makes, from the last $2433 write before it. */
    quantity: number | null;
    /** Which opcode placed it. */
    opcode: number;
}

/** Every NPC placement a script can reach, in walk order. */
export function extractSpawns(instructions: readonly DecodedInstruction[]): SpawnFacts[] {
    const out: SpawnFacts[] = [];
    let quantity: number | null = null;
    for (const ins of instructions) {
        for (const e of ins.effects) {
            if (e.kind === 'write' && e.addr === ENEMY_SPAWNER_QUANTITY) {
                quantity = e.value;
                continue;
            }
            if (e.kind !== 'spawn') continue;
            const named = enemyName(e.npc);
            out.push({
                npc: e.npc,
                name: named ? named.name : null,
                romName: named ? named.romName : null,
                character: named ? named.character : null,
                state: e.state,
                x: e.x,
                y: e.y,
                spawner: e.opcode === 0xc2,
                quantity: e.opcode === 0xc2 ? quantity : null,
                opcode: e.opcode,
            });
        }
    }
    return out;
}
