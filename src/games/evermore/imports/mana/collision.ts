// Ownership: Mana collision bytes as Evermore collision words (docs/mana/evermore-rooms.md
// "What maps onto what"): floors and levels, walls and diagonals, stairs, currents, how a
// character is drawn on the cell. Pure. The pairing was checked by walking the Boy headless
// through the converted Potos Falls (tests/mana/mana-play.test.js).

import * as mana from '../../../mana/decoder';

const STEP_ON = 0x4000;
/** Bit 15: pressing B at the cell checks the room's B-trigger boxes (map_collision_mechanics.md §7.1). */
const INTERACT = 0x8000;
/** Evermore geometry nibble for each Mana diagonal (docs/map-format/map_collision_mechanics.md §5). */
const DIAGONAL_GEOMETRY: Record<number, number> = { 4: 0x02, 5: 0x09, 6: 0x0A, 7: 0x01 };
const SOLID = 0x0F, PLANE_1 = 0x10, PLANE_2 = 0x20, PLANE_TRANSPARENT = 0x40;
/** Bit 13, always walkable: the low nibble is a drift instead of geometry (map_collision_mechanics.md §6). */
const WALKABLE = 0x2000;
/**
 * Nibble 3 under bit 13: no drift ($8FAE46, as nibble 0), but not the vertical-stairs mark the
 * editor and vanilla give nibble 0 (vanilla-stairs.ts).
 */
const NO_DRIFT = 0x3;
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
 *   lets a walker change plane only from such a cell. The floor takes nibble 3 (no drift, not
 *   stairs); stairs `$20`/`$21` nibble 0 (Evermore's vertical stairs), `$22`/`$23` the shears on
 *   every cell (Mana's slope is half Evermore's: the speed is not converted), push `$3n` the drift
 *   of its direction (Evermore's drift has one speed; Mana's 1-3 is lost);
 * - sprite priority c1 7 (in front) sets bit 12, c1 2 (split) gate nibble 4; 6 and the rest
 *   leave both clear (behind the high-priority tiles), as does a cell that keeps the priority;
 * - an event cell that becomes a B-trigger (`bTrigger`: a signpost or a door, solid in Mana) is a
 *   wall with bit 15, so Evermore runs it when B is pressed facing it; `step` sets bit 14.
 */
function collisionWord(c0: number, c2: number, step: boolean, c1 = 0, bTrigger = false): number {
    const floor = c0 & 7, diag = mana.diagonalOf(c2), effect = c2 & 0xF0;
    const plane = floor === 1 ? PLANE_1 : PLANE_2;
    if (bTrigger) return SOLID | plane | INTERACT;
    let w: number;
    if (diag) w = DIAGONAL_GEOMETRY[diag] | (floor === 1 ? PLANE_1 : PLANE_2);
    else if (floor === 3) w = SOLID | PLANE_2;
    else if (effect === 0x20) w = WALKABLE | (SHEAR[c2] ?? 0) | plane;
    else if (effect === 0x30) w = WALKABLE | DRIFT[c2 & 3] | plane;
    else if (floor === 1) w = PLANE_1;
    else if (floor === 2) w = PLANE_2;
    else if (floor === 0) w = WALKABLE | NO_DRIFT | PLANE_2;
    else w = PLANE_2 | PLANE_TRANSPARENT;
    if (floor < 4 && floor !== 3) {
        if ((c1 & 7) === 7) w |= IN_FRONT;
        else if ((c1 & 7) === 2) w |= SPLIT;
    }
    return step ? w | STEP_ON : w;
}


export { collisionWord };
