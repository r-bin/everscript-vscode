// Ownership: what cuttable grass contributes to the vanilla index — which
// graphics take part in it, and the ones that only ever appear once grass is
// cut. Pure.
//
// Split out of vanilla-index.ts. The swap table itself is parsed by
// cuttable-grass.ts; this reads it for the index.

import { RoomData } from './room';
import { metatileIndex } from './metatiles';

export const GRASS_UNCUT = 1;
export const GRASS_CUT = 2;

/**
 * A graphic that appears when grass is cut. `uses` is how many cells hold
 * the uncut metatile — how often vanilla would show it once they are cut.
 */
export interface GrassReveal {
    graphic: number;
    word: number;
    /** 0 = canopy (Layer 1), 1 = terrain (Layer 2). */
    layer: 0 | 1;
    uses: number;
    collision: number;
}

/**
 * Flag the graphics this room's grass records change, into `into`, and
 * return the cut states.
 *
 * Only a layer whose word changes along a record counts — the floor a bush
 * stands on is not part of cutting it — and the blank canopy word cut grass
 * often leaves behind is "nothing here", not a grass graphic.
 *
 * The reveals matter because a cut-state metatile is **never placed** in a
 * vanilla grid: it only exists at run time. An index built from placements
 * alone never saw the stubble graphics (677, 685, 691 in Act 1), so no tile
 * list could offer them.
 */
export function noteGrass(
    room: RoomData,
    graphicOf: (word: number) => number | undefined,
    blankCanopy: number,
    into: Map<number, number>,
): GrassReveal[] {
    const records = room.cuttableGrass.table.records;
    if (!records.length) return [];
    const { layer1, layer2, collision } = room.metatileSlices;
    const uses = new Map<number, number>();
    for (const row of room.layer1MetatileIds) for (const id of row) uses.set(id, (uses.get(id) || 0) + 1);

    const reveals: GrassReveal[] = [];
    for (const rec of records) {
        const ids = [rec.source, ...rec.sequence];
        const chain = ids.map((id) => metatileIndex(room, id));
        if (chain.some((i) => i < 0 || i >= room.metatileCount)) continue;
        const cells = uses.get(rec.source) || 0;
        ([[0, layer1], [1, layer2]] as const).forEach(([layer, words]) => {
            if (new Set(chain.map((i) => words[i])).size < 2) return; // this layer never changes
            chain.forEach((i, k) => {
                if (layer === 0 && words[i] === blankCanopy) return;
                const g = graphicOf(words[i] || 0);
                if (g === undefined) return;
                into.set(g, (into.get(g) || 0) | (k === 0 ? GRASS_UNCUT : GRASS_CUT));
                if (k > 0 && cells) reveals.push({ graphic: g, word: words[i], layer, uses: cells, collision: collision[i] });
            });
        });
    }
    return reveals;
}
