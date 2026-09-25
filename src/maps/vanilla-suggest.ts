// Ownership: what the vanilla index *suggests* for one graphic — its tile
// family, the layer it is drawn on, and the collision under it. Pure.
//
// Split out of vanilla-index.ts (which builds the index) when the collision
// shape suggestion pushed that file past 400 lines: building the counts and
// reading an answer off them are two different jobs.

import { Attestation, VanillaIndex } from './vanilla-index';
import { ALWAYS_WALKABLE, suggestStairs as stairsOf } from './vanilla-stairs';

/** A suggestion, with the evidence that produced it. */
export interface Suggestion {
    value: number;
    /** Share of this graphic's placements, 0..1. */
    confidence: number;
    uses: number;
    /** Everything observed, most-placed first — the suggestion is `[0]`. */
    alternatives: Attestation<number>[];
}

function suggest(list: Attestation<number>[] | undefined): Suggestion | null {
    if (!list || !list.length) return null;
    const total = list.reduce((n, a) => n + a.uses, 0);
    return {
        value: list[0].value,
        confidence: total ? list[0].uses / total : 0,
        uses: list[0].uses,
        alternatives: list,
    };
}

/** Which family vanilla draws this graphic in. `null` if never seen. */
export function suggestFamily(index: VanillaIndex, graphic: number): Suggestion | null {
    return suggest(index.families.get(graphic));
}

/**
 * Which layer vanilla draws this graphic on.
 *
 * `'canopy'` is the part drawn over the character, `'terrain'` the ground
 * it walks on. Returns `null` for a graphic nothing has drawn.
 */
export function preferredLayer(
    index: VanillaIndex,
    graphic: number,
): { layer: 'canopy' | 'terrain'; confidence: number; canopy: number; terrain: number } | null {
    const seen = index.layers.get(graphic);
    if (!seen) return null;
    const total = seen.canopy + seen.terrain;
    if (!total) return null;
    const canopyWins = seen.canopy > seen.terrain;
    return {
        layer: canopyWins ? 'canopy' : 'terrain',
        confidence: (canopyWins ? seen.canopy : seen.terrain) / total,
        canopy: seen.canopy,
        terrain: seen.terrain,
    };
}

/** The part of a collision word that is the shape the red lines draw. */
export const GEOMETRY_BITS = 0x0f;

/**
 * The shape a word draws. With bit 13 (always-walkable) set the low nibble
 * is a drift or stairs direction, not geometry, and the tile is open.
 */
export function shapeOf(word: number): number {
    return word & ALWAYS_WALKABLE ? 0 : word & GEOMETRY_BITS;
}

/**
 * Which collision *shape* vanilla gives this graphic on this layer.
 *
 * The shape, not the whole word: measured leave-one-room-out over all 127
 * rooms, a terrain graphic predicts the geometry nibble 77% of the time but
 * the full word only 58% — planes, gates and sprite bits depend on the room,
 * not the tile. `confidence` is well calibrated: a suggestion vanilla agrees
 * with 95% of the time was right in 92% of unseen-room cells, one under 60%
 * in 35%. See docs/map-format/collision-suggestions.md.
 */
export function suggestGeometry(index: VanillaIndex, graphic: number, layer: 'terrain' | 'canopy'): Suggestion | null {
    const words = (layer === 'canopy' ? index.canopyCollisions : index.collisions).get(graphic);
    if (!words) return null;
    const byShape = new Map<number, number>();
    for (const a of words) byShape.set(shapeOf(a.value), (byShape.get(shapeOf(a.value)) || 0) + a.uses);
    const list = [...byShape].map(([value, uses]) => ({ value, uses }));
    list.sort((a, b) => b.uses - a.uses || a.value - b.value);
    return suggest(list);
}

/** Which collision word vanilla puts under this terrain graphic. */
export function suggestCollision(index: VanillaIndex, graphic: number): Suggestion | null {
    return suggest(index.collisions.get(graphic));
}

/**
 * Whether vanilla draws this graphic as stairs on this layer, and which way
 * it rises drawn unflipped (1 right, 2 left). `null` if not stairs.
 */
export function suggestStairs(index: VanillaIndex, graphic: number, layer: 'terrain' | 'canopy'): { nibble: number; confidence: number } | null {
    return stairsOf(index.stairs, graphic, layer);
}
