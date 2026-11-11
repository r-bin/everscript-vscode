/*
 * $8C:D76B script_op_1b_write_tile_pair (knowledge/routines/script_op_1b_write_tile_pair.md), RTS, 16-bit A, X, Y.
 *
 * Reads two destination save-word offsets and two 8-bit tile coordinates from [$82], scales the
 * coordinates by 8, and stores them at $2258 + offset.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_op_1b_write_tile_pair ($8CD76B) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  28 instructions (50 bytes)
 * - Compiled C ASM:   303 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   10.8x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      a3aee2e00970d483
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(script_op_1b_write_tile_pair, 0x8CD76B, RTS)
{
    SOE_AT(0xD76B);
    r->p &= ~SOE_C;
    r->x = soe_adc16(r, 0x2258, LONG16(SOE_DPPTR(r, 0x82)));
    DP16(r, 0x82) = (uint16_t)(DP16(r, 0x82) + 2);

    r->p &= ~SOE_C;
    r->y = soe_adc16(r, 0x2258, LONG16(SOE_DPPTR(r, 0x82)));
    DP16(r, 0x82) = (uint16_t)(DP16(r, 0x82) + 2);

    uint16_t v1 = (uint16_t)((LONG16(SOE_DPPTR(r, 0x82)) & 0x00FF) << 3);
    DP16(r, 0x82) = (uint16_t)(DP16(r, 0x82) + 1);
    ABSI16(r, 0x0000, r->x) = v1;

    uint16_t v2 = (uint16_t)((LONG16(SOE_DPPTR(r, 0x82)) & 0x00FF) << 3);
    DP16(r, 0x82) = (uint16_t)(DP16(r, 0x82) + 1);
    ABSI16(r, 0x0000, r->y) = v2;

    r->a = v2;
    soe_nz16(r, v2);
    r->p |= SOE_C;
}
