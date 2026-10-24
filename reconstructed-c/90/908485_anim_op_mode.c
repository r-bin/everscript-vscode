/*
 * $90:8485 anim_op_mode (knowledge/rom/908485.md), RTS, 8-bit A on entry and exit.
 *
 * rec + $16 (Y, DB-relative) = the word at the animation script pointer DP $5D (24-bit), which
 * steps by 2. Leaves A = the word, X = the new pointer, N Z from the INX.
 */
#include "soe.h"

SOE_BIND(anim_op_mode, 0x908485, RTS)
{
    uint16_t word = LONG16(SOE_DPPTR(r, 0x5D));
    uint16_t x = (uint16_t)(DP16(r, 0x5D) + 2);

    ABSI16(r, 0x0016, r->y) = word;
    DP16(r, 0x5D) = x;
    r->a = word;
    r->x = x;
    soe_nz16(r, x);
    r->p |= SOE_M;
}
