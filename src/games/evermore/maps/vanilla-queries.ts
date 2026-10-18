// Ownership: questions asked of the vanilla index about a set of graphics — which rooms draw them
// together, what a family holds, and a graphic's category (unused, canopy, dual-layer). Pure.
// The index itself is ./vanilla-index; relationships between graphics are ./vanilla-related.

import { VanillaIndex } from './vanilla-index';

/** Graphics that appear in exactly the same set of rooms. */
export interface GraphicGroup {
    /** The rooms every graphic in this group appears in. */
    rooms: number[];
    graphics: number[];
}

/**
 * Group graphics by the rooms that draw them.
 *
 * "Which tiles are used together" is not a property the ROM stores, but it
 * falls straight out of the index: graphics that appear in exactly the same
 * rooms were put there by the same artist for the same scene. Grouping by
 * that signature turns a flat list of 157 tiles into a handful of coherent
 * sets — the wall tiles, the floor tiles, the one-off decorations.
 *
 * Groups are returned largest first, and graphics the index has never seen
 * are collected into a final group with an empty room list.
 */
export function groupByRooms(index: VanillaIndex, graphics: number[]): GraphicGroup[] {
    const bySignature = new Map<string, GraphicGroup>();
    for (const graphic of graphics) {
        const rooms = index.graphicRooms.get(graphic) || [];
        const signature = rooms.join(',');
        const group = bySignature.get(signature);
        if (group) group.graphics.push(graphic);
        else bySignature.set(signature, { rooms, graphics: [graphic] });
    }
    return [...bySignature.values()].sort(
        (a, b) => b.graphics.length - a.graphics.length || (a.rooms[0] ?? 1e9) - (b.rooms[0] ?? 1e9),
    );
}

/**
 * Every graphic attested in any of these families.
 *
 * This is what a family picker turns into a filtered tile list: choose the
 * seven, get the vocabulary. Room 0x34's set yields 157 graphics, against
 * ~264 loadable slots — the family choice, not the slot budget, is what
 * limits a room in practice.
 */
export function graphicsForFamilies(index: VanillaIndex, families: number[]): number[] {
    const seen = new Set<number>();
    for (const fam of families) {
        for (const a of index.graphics.get(fam) || []) seen.add(a.value);
    }
    return [...seen].sort((a, b) => a - b);
}

/**
 * The most-placed graphics of a family — a preview strip for a picker.
 *
 * Ordered by placements rather than id, because the point is "what does
 * this family look like in practice", and the first eight by id are as
 * likely to be corner pieces as anything recognisable.
 */
export function familyExamples(index: VanillaIndex, family: number, limit = 8): number[] {
    return (index.graphics.get(family) || []).slice(0, limit).map((a) => a.value);
}

/**
 * Check if a graphic is unused in vanilla (0 placements on any room grid).
 */
export function isUnusedGraphic(index: VanillaIndex, graphic: number): boolean {
    return (index.cells.get(graphic) || 0) === 0 && !index.grass.has(graphic);
}

/**
 * Check if a graphic is drawn predominantly on the canopy layer (overhead canopy / front layer).
 */
export function isCanopyGraphic(index: VanillaIndex, graphic: number): boolean {
    const seen = index.layers.get(graphic);
    if (!seen || !seen.canopy) return false;
    return seen.canopy > seen.terrain;
}

/**
 * Check if a graphic needs 2 layers with no canopy to look complete (dual-layer ground).
 */
export function isDualLayerGraphic(index: VanillaIndex, graphic: number): boolean {
    const dual = index.dualNoCanopy.get(graphic) || 0;
    if (!dual) return false;
    const total = index.cells.get(graphic) || 0;
    if (!total) return false;
    const seen = index.layers.get(graphic);
    const singleGround = (seen ? seen.terrain : 0) - dual;
    return dual >= singleGround;
}

/**
 * Category flags bitmask for a graphic:
 * - bit 0 (0x01): unused in vanilla
 * - bit 1 (0x02): canopy tile (overhead / front layer)
 * - bit 2 (0x04): needs 2 layers with no canopy to look complete
 */
export function tileCategoryFlags(index: VanillaIndex, graphic: number): number {
    let f = 0;
    if (isUnusedGraphic(index, graphic)) f |= 1;
    if (isCanopyGraphic(index, graphic)) f |= 2;
    if (isDualLayerGraphic(index, graphic)) f |= 4;
    return f;
}
