// Ownership: where a script sends the player (0x22 change_map), with what it does on the way
// out — the global scripts it calls (fades, which edge you leave by), the music it starts, the
// room state it writes — read per path. Pure.

import type { Step } from './paths';
import { LOOT_CELLS } from './loot';
import { globalScriptName, mapName, memoryName } from './names';

export interface TransitionFacts {
    /** The room it leads to. */
    mapId: number;
    mapName: string;
    /** Where the player lands, in pixels (the operands are tiles). */
    x: number;
    y: number;
    /** Global scripts called on the way out. */
    prepares: Array<{ id: number; name: string }>;
    /** Music started on the way, if any. */
    music: number | null;
    /** Constant writes on the way: the room state it sets up. */
    writes: Array<{ addr: number; name: string; value: number }>;
    /** The change_map instruction. */
    at: number;
}

const TILE = 8;

/** Every map change the paths reach, once per instruction (the first path that reaches it). */
export function doorsOf(paths: Step[][]): TransitionFacts[] {
    const out = new Map<number, TransitionFacts>();
    for (const path of paths) {
        let prepares: TransitionFacts['prepares'] = [];
        let writes: TransitionFacts['writes'] = [];
        let music: number | null = null;
        for (const { ins, fact } of path) {
            if (fact.k === 'call' && fact.global !== null) prepares.push({ id: fact.global, name: globalScriptName(fact.global) });
            else if (fact.k === 'music') music = fact.index;
            else if (fact.k === 'write' && fact.area !== 'local' && fact.value !== null && !LOOT_CELLS.has(fact.addr)) {
                writes.push({ addr: fact.addr, name: memoryName(fact.addr), value: fact.value });
            } else if (fact.k === 'changeMap' && fact.map !== null) {
                if (!out.has(ins.address)) {
                    out.set(ins.address, { mapId: fact.map, mapName: mapName(fact.map), x: fact.x * TILE, y: fact.y * TILE, prepares, music, writes, at: ins.address });
                }
                prepares = []; writes = []; music = null;
            }
        }
    }
    return [...out.values()].sort((a, b) => a.at - b.at);
}
