// Ownership: which graphics vanilla draws as stairs, and which way they
// climb. Pure.
//
// Stairs are a collision flag: bit 13 (always-walkable) with drift nibble 1
// or 2, the two "shear" handlers of docs/map-format/map_collision_mechanics.md
// §6. Nibble 1: walking east also climbs north (the stairs rise to the
// right); nibble 2: walking east descends (they rise to the left). Vanilla
// uses them only in castle and tower rooms (Ebon Keep, Ivor Tower, 0x0d's
// staircase hall, the 0x75 stairwell) and only under stair art.
//
// The direction is the art's: an unflipped stair graphic carries nibble 1
// and its H-mirrored copy nibble 2, in every room measured. So the index
// records a graphic's direction *as drawn unflipped*, and whoever paints it
// swaps 1 and 2 when the word is H-flipped (`stairsForWord`).
//
// See docs/map-format/collision-suggestions.md, "Stairs".

/** Always-walkable: the low nibble is a drift direction, not geometry. */
export const ALWAYS_WALKABLE = 0x2000;
/** The two stair directions (drift nibbles 1 and 2). */
export const STAIRS_RISE_RIGHT = 1;
export const STAIRS_RISE_LEFT = 2;
const H_FLIP = 0x4000;

/** Below this share of a graphic's placements, it is not a stairs tile. */
export const STAIRS_MIN_SHARE = 0.5;

/** The stairs nibble a collision word carries, or 0. */
export function stairsNibble(collision: number): number {
    if (!(collision & ALWAYS_WALKABLE)) return 0;
    const n = collision & 0x0f;
    return n === STAIRS_RISE_RIGHT || n === STAIRS_RISE_LEFT ? n : 0;
}

/** Swap the direction for an H-flipped word; the same swap turns it back. */
export function stairsForWord(nibble: number, word: number): number {
    if (!nibble) return 0;
    return word & H_FLIP ? 3 - nibble : nibble;
}

/** One graphic on one layer: placements, stair placements, and how many rose right. */
export interface StairsCount { total: number; stairs: number; right: number }

export type StairsTally = Map<number, { terrain: StairsCount; canopy: StairsCount }>;

/** Count one placement of `graphic`, drawn with `word` on `layer`, over `collision`. */
export function noteStairs(
    into: StairsTally, graphic: number, layer: 'terrain' | 'canopy',
    word: number, collision: number, uses: number,
): void {
    let g = into.get(graphic);
    if (!g) {
        g = { terrain: { total: 0, stairs: 0, right: 0 }, canopy: { total: 0, stairs: 0, right: 0 } };
        into.set(graphic, g);
    }
    const c = g[layer];
    c.total += uses;
    const n = stairsNibble(collision);
    if (!n) return;
    c.stairs += uses;
    if (stairsForWord(n, word) === STAIRS_RISE_RIGHT) c.right += uses;
}

/** One placed stamp: its terrain and (real, not blank) canopy graphic, either may be absent. */
export function noteStairsCell(
    into: StairsTally, terrain: number | undefined, canopy: number | undefined,
    m: { layer1: number; layer2: number; collision: number; uses: number },
): void {
    if (terrain !== undefined) noteStairs(into, terrain, 'terrain', m.layer2, m.collision, m.uses);
    if (canopy !== undefined) noteStairs(into, canopy, 'canopy', m.layer1, m.collision, m.uses);
}

/** Keep only graphics that were ever stairs — the rest answer "no" by absence. */
export function compactStairs(all: StairsTally): StairsTally {
    const out: StairsTally = new Map();
    for (const [g, v] of all) if (v.terrain.stairs || v.canopy.stairs) out.set(g, v);
    return out;
}

/**
 * Is this graphic stairs on this layer, and which way does it rise, drawn
 * unflipped? `null` when vanilla draws it as stairs under half the time.
 */
export function suggestStairs(
    stairs: StairsTally, graphic: number, layer: 'terrain' | 'canopy',
): { nibble: number; confidence: number } | null {
    const g = stairs.get(graphic);
    const c = g && g[layer];
    if (!c || !c.total || c.stairs / c.total < STAIRS_MIN_SHARE) return null;
    return {
        nibble: c.right * 2 >= c.stairs ? STAIRS_RISE_RIGHT : STAIRS_RISE_LEFT,
        confidence: c.stairs / c.total,
    };
}
