// Ownership: what the vanilla index *suggests* for one graphic — its tile
// family, the layer it is drawn on, and the collision under it. Pure.
//
// Split out of vanilla-index.ts (which builds the index) when the collision
// shape suggestion pushed that file past 400 lines: building the counts and
// reading an answer off them are two different jobs.

import { Attestation, VanillaIndex } from './vanilla-index';

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
    for (const a of words) byShape.set(a.value & GEOMETRY_BITS, (byShape.get(a.value & GEOMETRY_BITS) || 0) + a.uses);
    const list = [...byShape].map(([value, uses]) => ({ value, uses }));
    list.sort((a, b) => b.uses - a.uses || a.value - b.value);
    return suggest(list);
}

/** Which collision word vanilla puts under this terrain graphic. */
export function suggestCollision(index: VanillaIndex, graphic: number): Suggestion | null {
    return suggest(index.collisions.get(graphic));
}
