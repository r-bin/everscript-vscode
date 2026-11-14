// Ownership: Mana collision bytes as Evermore collision words (docs/mana/evermore-rooms.md
// "What maps onto what"): floors and levels, walls and diagonals, stairs, currents, how a
// character is drawn on the cell. Pure. The pairing was checked by walking the Boy headless
// through the converted Potos Falls (tests/mana/mana-play.test.js).

import * as mana from '../../../mana/decoder';

const STEP_ON = 0x4000;
/** Evermore geometry nibble for each Mana diagonal (docs/map-format/map_collision_mechanics.md §5). */
const DIAGONAL_GEOMETRY: Record<number, number> = { 4: 0x02, 5: 0x09, 6: 0x0A, 7: 0x01 };
const SOLID = 0x0F, PLANE_1 = 0x10, PLANE_2 = 0x20, PLANE_TRANSPARENT = 0x40;
/** Bit 13, always walkable: the low nibble is a drift instead of geometry (map_collision_mechanics.md §6). */
const WALKABLE = 0x2000;
/** Bit 12: a character on this cell's plane is drawn in front of everything (sprite_priority.md). */
const IN_FRONT = 0x1000;
/** Gate nibble 4: the split, marked sprite chunks in front, the rest behind (wading.md). */
const SPLIT = 0x0400;
/** Drift nibbles for Mana's push directions `n & 3`: up, down, left, right. */
const DRIFT = [0x8, 0xF, 0xD, 0xA];
/** Mana stairs `$22` (going right climbs) and `$23` (going right descends): Evermore's shears. */
const SHEAR: Record<number, number> = { 0x22: 0x1, 0x23: 0x2 };

/**
 * Evermore collision word for Mana collision bytes c0, c1, c2 (both games' docs; checked by
 * walking the Boy over Potos Falls' bridge headless):
 * - level 1 and 2 floors are planes 1 and 2, each solid from the other, as in Mana;
 * - a floor that keeps the level (c0 4-7, the bridge deck) is plane-transparent;
 * - a floor of no level (c0 0) and every stair and push cell are always walkable (bit 13): Evermore
 *   lets a walker change plane only from such a cell. Plane 0 when Mana's level is 0, so every
 *   plane may enter; otherwise the cell's level, so the sprite rules below still apply there;
 * - stairs `$20`/`$21` keep nibble 0 (Evermore's vertical stairs), `$22`/`$23` take the shears,
 *   push `$3n` the drift of its direction (Evermore's drift has one speed; Mana's 1-3 is lost);
 * - sprite priority c1 7 (in front) sets bit 12, c1 2 (split) gate nibble 4; 6 and the rest
 *   leave both clear (behind the high-priority tiles), as does a cell that keeps the priority.
 */
function collisionWord(c0: number, c2: number, step: boolean, c1 = 0): number {
    const floor = c0 & 7, diag = mana.diagonalOf(c2), effect = c2 & 0xF0;
    const plane = floor === 1 ? PLANE_1 : PLANE_2;
    let w: number;
    if (diag) w = DIAGONAL_GEOMETRY[diag] | (floor === 1 ? PLANE_1 : PLANE_2);
    else if (floor === 3) w = SOLID | PLANE_2;
    else if (effect === 0x20) w = WALKABLE | (SHEAR[c2] ?? 0) | plane;
    else if (effect === 0x30) w = WALKABLE | DRIFT[c2 & 3] | plane;
    else if (floor === 1) w = PLANE_1;
    else if (floor === 2) w = PLANE_2;
    else if (floor === 0) w = WALKABLE | PLANE_2;
    else w = PLANE_2 | PLANE_TRANSPARENT;
    if (floor < 4 && floor !== 3) {
        if ((c1 & 7) === 7) w |= IN_FRONT;
        else if ((c1 & 7) === 2) w |= SPLIT;
    }
    return step ? w | STEP_ON : w;
}


/**
 * Mana's diagonal stairs as Evermore can walk them, on Mana's stair cells only. Evermore's shear
 * lifts a walker one pixel per pixel it walks, Mana's `$22`/`$23` one per two; a column of shear
 * cells lifts a walker into the wall above. So per column run of shear cells the shear stays on
 * the lowest row only; the rows above stay always walkable with no shear (Evermore's vertical
 * stairs). Walked headless at Potos Falls' bridge: across on the upper row both ways, up from
 * the lower row on the right; from the lower row on the left the post stops the Boy 6 pixels up
 * (one cell gives too short a run), and a touch of up takes him onto the deck.
 */
function shapeStairs(cells: number[], w: number, h: number) {
    const at = (x: number, y: number) => (y * w + x) * 3 + 2;
    const shearOf = (x: number, y: number) => (x >= 0 && x < w && y >= 0 && y < h && (cells[at(x, y)] & 0x200F) >= 0x2001
        && (cells[at(x, y)] & 0x200F) <= 0x2002 ? cells[at(x, y)] & 0xF : 0);
    for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) {
            const n = shearOf(x, y);
            if (!n || shearOf(x, y + 1) === n) continue;                 // not the lowest of its run
            for (let up = y - 1; up >= 0 && shearOf(x, up) === n; up--) cells[at(x, up)] &= ~0x0F;
        }
    }
}

export { collisionWord, shapeStairs };
