/*
 * $90:8453 anim_op_reset (knowledge/rom/908453.md), RTS, 8-bit A on entry and exit.
 *
 * In: Y = the entity record (DB-relative), copied to X. Clears +$82, +$16, +$42, +$06, +$08, +$0A,
 * sets +$44 = $FFF0; when +$16 had bit 4, also clears +$2E and bit 9 of +$14.
 * Leaves A = $FFF0, X = Y, N Z from the LDA #$FFF0.
 */
#include "soe.h"

SOE_BIND(anim_op_reset, 0x908453, RTS)
{
    uint16_t x = r->y;

    r->x = x;
    ABSI16(r, 0x0082, x) = 0;
    if (ABSI16(r, 0x0016, x) & 0x0010) {
        ABSI16(r, 0x002E, x) = 0;
        ABSI16(r, 0x0014, x) = (uint16_t)(ABSI16(r, 0x0014, x) & 0xFDFF);
    }
    ABSI16(r, 0x0016, x) = 0;
    ABSI16(r, 0x0042, x) = 0;
    ABSI16(r, 0x0044, x) = 0xFFF0;
    ABSI16(r, 0x0006, x) = 0;
    ABSI16(r, 0x0008, x) = 0;
    ABSI16(r, 0x000A, x) = 0;
    r->a = 0xFFF0;
    soe_nz16(r, 0xFFF0);
    r->p |= SOE_M;
}
