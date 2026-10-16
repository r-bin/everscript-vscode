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
// Vertical stairs — steps climbed up the screen — are bit 13 with nibble 0:
// always walkable, no drift. Vanilla puts that word under its step art
// (1592/1595 beside the diagonal stairs in 0x0b/0x2b, 1877 through Ebon Keep
// and Ivor Tower, the log steps of 0x65). Bit 13 also keeps the entity's
// level ($8FA914), which is what lets a staircase join two levels. A few
// filler tiles in 0x65 carry the same word; they are listed too, since the
// game treats them the same way.
//
// The direction is the art's: an unflipped stair graphic carries nibble 1
// and its H-mirrored copy nibble 2, in every room measured. So the index
// records a graphic's direction *as drawn unflipped*, and whoever paints it
// swaps 1 and 2 when the word is H-flipped (`stairsForWord`).
//
// See docs/map-format/collision-suggestions.md, "Stairs".

/** Always-walkable: the low nibble is a drift direction, not geometry. */
export const ALWAYS_WALKABLE = 0x2000;
/**
 * The three kinds of stairs. Kinds 1 and 2 are the drift nibbles themselves;
 * vertical stairs (kind 3) are nibble 0.
 */
export const STAIRS_RISE_RIGHT = 1;
export const STAIRS_RISE_LEFT = 2;
export const STAIRS_VERTICAL = 3;
const H_FLIP = 0x4000;

/** Below this share of a graphic's placements, it is not a stairs tile. */
export const STAIRS_MIN_SHARE = 0.5;

/** The kind of stairs a collision word is (1 right, 2 left, 3 vertical), or 0. */
export function stairsNibble(collision: number): number {
    if (!(collision & ALWAYS_WALKABLE)) return 0;
    const n = collision & 0x0f;
    if (n === 0) return STAIRS_VERTICAL;
    return n === STAIRS_RISE_RIGHT || n === STAIRS_RISE_LEFT ? n : 0;
}

/** Swap a diagonal's direction for an H-flipped word; the same swap turns it back. */
export function stairsForWord(kind: number, word: number): number {
    if (!kind || kind === STAIRS_VERTICAL) return kind;
    return word & H_FLIP ? 3 - kind : kind;
}

/** The collision word a kind of stairs writes: bit 13 and its nibble. */
export function stairsCollision(kind: number): number {
    return ALWAYS_WALKABLE | (kind === STAIRS_VERTICAL ? 0 : kind);
}

/** One graphic on one layer: placements, stair placements, how many rose right, how many were vertical. */
export interface StairsCount { total: number; stairs: number; right: number; vertical: number }

export type StairsTally = Map<number, { terrain: StairsCount; canopy: StairsCount }>;

/** Count one placement of `graphic`, drawn with `word` on `layer`, over `collision`. */
export function noteStairs(
    into: StairsTally, graphic: number, layer: 'terrain' | 'canopy',
    word: number, collision: number, uses: number,
): void {
    let g = into.get(graphic);
    if (!g) {
        g = { terrain: { total: 0, stairs: 0, right: 0, vertical: 0 }, canopy: { total: 0, stairs: 0, right: 0, vertical: 0 } };
        into.set(graphic, g);
    }
    const c = g[layer];
    c.total += uses;
    const n = stairsNibble(collision);
    if (!n) return;
    c.stairs += uses;
    if (n === STAIRS_VERTICAL) c.vertical += uses;
    else if (stairsForWord(n, word) === STAIRS_RISE_RIGHT) c.right += uses;
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
 * Is this graphic stairs on this layer, and which kind — vertical, or the
 * way a diagonal rises drawn unflipped? `null` when vanilla draws it as
 * stairs under half the time.
 */
export function suggestStairs(
    stairs: StairsTally, graphic: number, layer: 'terrain' | 'canopy',
): { nibble: number; confidence: number } | null {
    const g = stairs.get(graphic);
    const c = g && g[layer];
    if (!c || !c.total || c.stairs / c.total < STAIRS_MIN_SHARE) return null;
    const diagonal = c.stairs - c.vertical;
    let nibble = STAIRS_VERTICAL;
    if (c.vertical * 2 < c.stairs) nibble = c.right * 2 >= diagonal ? STAIRS_RISE_RIGHT : STAIRS_RISE_LEFT;
    return { nibble, confidence: c.stairs / c.total };
}
