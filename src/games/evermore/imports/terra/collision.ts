// Ownership: Terranigma cell types as Evermore collision words (docs/terra/evermore-rooms.md "What maps onto
// what"): open, wall, the two slopes, one-way cells, sprite priority. Pure.
//
// Terranigma: what a type does is read from the movement code's own jump tables (games/terra/decoder
// collision.ts, docs/terra/README.md §3.6). Evermore: the collision word (docs/map-format/
// map_collision_mechanics.md §5 for the geometry nibble, sprite_priority.md for bit 12).

import * as terra from '../../../terra/decoder';

const SOLID = 0x0F, PLANE_2 = 0x20;
/** Bit 12: a character on this cell's plane is drawn in front of everything (sprite_priority.md). */
const IN_FRONT = 0x1000;
/** Evermore geometry with the lower-right / upper-left / lower-left / upper-right half solid (§5: SE, NW, SW, NE). */
const SE = 0x01, NW = 0x0A, SW = 0x02, NE = 0x09;
/** Terranigma's slope types: 6 a `/` line, 7 a `\` line (docs/terra/README.md §3.6). */
const SLASH = 6, BACKSLASH = 7;

type Rules = ReturnType<typeof terra.cellTypeRules>;

/**
 * The collision of a `w` × `h` map whose cell types `typeAt(x, y)` gives (-1: no cell, a wall): every cell's
 * word, and `word(x, y, type)` for a cell that a map change gives another type (its neighbours as loaded).
 * - a type every move passes: floor, plane 2 (`$20`);
 * - a wall in every direction, and a type only some moves pass (8 a ledge crossed in a jump, `$1F` a drop, `$1A`):
 *   geometry `$F` (`$2F`). Evermore has no jump and no one-way cells: the ledge stays the obstacle it is on foot;
 * - the slopes: the type gives the line, not the solid half; the cells around it do (§3.6, walked in the game: a
 *   `/` with walls below and right is solid lower right). Terranigma's line is thin: the player stands on either
 *   side of it. Evermore's is a solid half, so it goes to the side that is less floor: a wall neighbour counts for
 *   that side (a one-way cell is a wall here too), an open one against it (a slope neither). Counting walls alone tied at the top of
 *   Crysta's diagonal ledge, (21,12): the lower right, where Ark walks up the slope, came out solid;
 * - bit 0 of the ground word (`$80:E11C`: such characters are drawn with sprite priority `$3000`): bit 12.
 */
function collisionWords(rules: Rules, w: number, h: number, typeAt: (x: number, y: number) => number) {
    const kind = rules.map((r) => terra.cellClass(r));
    const wall = (x: number, y: number) => {
        const t = typeAt(x, y);
        return t < 0 || kind[t] === 'wall' || kind[t] === 'one-way' ? 1 : kind[t] === 'open' ? -1 : 0;
    };
    const word = (x: number, y: number, t: number) => wordFor(rules, kind, t, x, y, wall);
    const words: number[] = new Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) words[y * w + x] = word(x, y, typeAt(x, y));
    return { words, word };
}

/** One cell's word (see collisionWords); `wall(x, y)`: 1 a wall neighbour, -1 an open one, 0 else. */
function wordFor(rules: Rules, kind: ReturnType<typeof terra.cellClass>[], t: number, x: number, y: number, wall: (x: number, y: number) => number): number {
    if (t < 0 || kind[t] === 'wall' || kind[t] === 'one-way') return SOLID | PLANE_2;
    if (t === SLASH) return (wall(x, y + 1) + wall(x + 1, y) >= wall(x, y - 1) + wall(x - 1, y) ? SE : NW) | PLANE_2;
    if (t === BACKSLASH) return (wall(x, y + 1) + wall(x - 1, y) >= wall(x, y - 1) + wall(x + 1, y) ? SW : NE) | PLANE_2;
    const r = rules[t];
    return r.ground === 'open' && (r.groundWord & 1) ? PLANE_2 | IN_FRONT : PLANE_2;
}

export { collisionWords, SOLID, PLANE_2 };
