/*
 * $90:9815 tile_property_at_pixel_xy (knowledge/routines/tile_property_at_pixel_xy.md), RTL, 16-bit A, X, Y.
 *
 * Looks up the tile property word at pixel (X, Y):
 * 1. Takes Y coordinate, masks and shifts to cell row: (Y & 0x0FF0) >> 3.
 * 2. Swaps bytes (XBA) and ORs with $08EE (ROOM_METATILE_WIDTH).
 * 3. Writes to hardware multiplier $004202.
 * 4. Takes X coordinate, masks and shifts to cell col: (X & 0x0FF0) >> 3.
 * 5. Adds hardware multiplier product from $004216.
 * 6. Stores pointer offset to DP $56.
 * 7. Reads cell word via [$56] into X.
 * 8. Returns tile property word from $7F0004,X in A.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   tile_property_at_pixel_xy ($909815) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  19 instructions (36 bytes)
 * - Compiled C ASM:   130 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   6.8x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      087b3c5a930f0173
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(tile_property_at_pixel_xy, 0x909815, RTL)
{
    SOE_AT(0x9815);
    uint16_t row = (uint16_t)((r->y & 0x0FF0) >> 3);
    uint16_t xba = (uint16_t)((row >> 8) | (row << 8));
    uint16_t factors = (uint16_t)(xba | ABS16(r, ROOM_METATILE_WIDTH_ADDR));

    IO16(0x4202) = factors;

    uint16_t col = (uint16_t)((r->x & 0x0FF0) >> 3);
    r->p &= ~SOE_C;
    uint16_t sum = soe_adc16(r, col, IO16(0x4216));

    DP16(r, 0x56) = sum;

    r->x = LONG16(SOE_DPPTR(r, 0x56));
    r->a = LONG16(0x7F0004UL + r->x);
    soe_nz16(r, r->a);
}
