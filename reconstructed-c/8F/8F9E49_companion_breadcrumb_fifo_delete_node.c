/*
 * $8F:9E49 companion_breadcrumb_fifo_delete_node (knowledge/rom/8f9e49.md), RTL, 16-bit A and X.
 *
 * In: DP $4E = a follower record (X), Y = the byte offset of the 3-byte breadcrumb to delete.
 * rec[$3BFF] (the list end) moves back by 3; n = end - Y - 1. n < 0: nothing to move (A = Y).
 * Else the n + 1 bytes after the node move down over it (MVN $7E,$7E from $3BC9+Y+3 to $3BC9+Y).
 * n >= $2D or a negative count halts the CPU (BRK, never seen). Leaves DB = $7E after a move.
 */
#include "soe.h"

SOE_BIND(companion_breadcrumb_fifo_delete_node, 0x8F9E49, RTL)
{
    uint16_t x = DP16(r, 0x4E);
    uint16_t y = r->y;
    uint16_t end, n;

    r->x = x;
    soe_carry(r, true);
    end = soe_sbc16(r, ABSI16(r, 0x3BFF, x), 0x0003);
    ABSI16(r, 0x3BFF, x) = end;
    soe_carry(r, false);
    n = soe_sbc16(r, end, y);                                /* PHY / CLC / SBC $01,s */
    if (n & 0x8000) {
        r->a = y;                                            /* PLA */
        soe_nz16(r, y);
        return;
    }
    soe_carry(r, false);
    r->y = soe_adc16(r, y, 0x3BC9);
    soe_carry(r, false);
    r->x = soe_adc16(r, r->y, 0x0003);
    soe_nz16(r, n);                                          /* PLA */
    if (n & 0x8000) soe_stp();
    soe_cmp16(r, n, 0x002D);
    if (r->p & SOE_C) soe_stp();
    r->a = n;
    soe_mvn(r, 0x7E, 0x7E);
}
