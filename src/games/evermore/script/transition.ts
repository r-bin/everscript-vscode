// Ownership: where a script sends the player, read out of the script. Pure.
//
// Most triggers in the game are doors. They follow one shape:
//
//   WRITE <some room state>        optional — set up the destination
//   CALL "Fade-out / stop music"   optional
//   CALL "Prepare room change? …"  optional — which edge you leave by
//   PLAY MUSIC <track>             optional
//   CHANGE MAP = 0x40 @ [ x | y ]  the transition itself
//   END
//
// Only the last line is required, and it is the one that carries the answer,
// so this records the destination and treats everything before it as context
// worth showing rather than as a pattern to match. A trigger that happens to
// prepare the room in an unusual way still reports where it goes.

import { DecodedInstruction } from './decoder';
import { globalScriptName, mapName, ramAddrToStr } from './names';

export interface TransitionFacts {
    /** Destination room id, as the vanilla catalogue keys it. */
    mapId: number;
    /** Its name, or empty when the room has none. */
    mapName: string;
    /** Where the player lands, in pixels. */
    x: number;
    y: number;
    /** Global scripts called on the way out — fades, edge preparation. */
    prepares: Array<{ id: number; name: string }>;
    /** Track started as part of the change, if any. */
    music: number | null;
    /** Writes made before the change: the room state it is setting up. */
    writes: Array<{ addr: number; name: string; value: number }>;
}

/** Writes to these are bookkeeping for the pickup system, not room setup. */
const LOOT_ADDRESSES = new Set([0x2391, 0x2393, 0x2395, 0x2461]);

/**
 * Every map change a script can make, in order.
 *
 * A list rather than one value: a trigger that branches can lead to different
 * rooms, and the decoder follows branches. Each `CHANGE MAP` closes a
 * transition and the context resets, so two exits in one script do not
 * inherit each other's preparation.
 */
export function extractTransitions(instructions: readonly DecodedInstruction[]): TransitionFacts[] {
    const out: TransitionFacts[] = [];
    let prepares: TransitionFacts['prepares'] = [];
    let writes: TransitionFacts['writes'] = [];
    let music: number | null = null;

    for (const ins of instructions) {
        for (const e of ins.effects) {
            if (e.kind === 'callGlobal') {
                prepares.push({ id: e.id, name: globalScriptName(e.id) });
            } else if (e.kind === 'playMusic') {
                music = e.track;
            } else if (e.kind === 'write' && e.value !== null && !LOOT_ADDRESSES.has(e.addr)) {
                writes.push({ addr: e.addr, name: ramAddrToStr(e.addr), value: e.value });
            } else if (e.kind === 'changeMap') {
                out.push({
                    mapId: e.mapId,
                    mapName: mapName(e.mapId),
                    x: e.x,
                    y: e.y,
                    prepares,
                    music,
                    writes,
                });
                prepares = [];
                writes = [];
                music = null;
            }
        }
    }
    return out;
}
