/*
 * Routine: $8CD71F (script_op_ae_write_local_tile_pair)
 * Bank: $8C
 *
 * Script VM opcode $AE: reads two 8-bit thread-local offsets (relative to
 * $7E + $000F) and two 8-bit tile coordinates from [$82], scales the tile
 * coordinates by 8 (<< 3), and writes both words.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_op_ae_write_local_tile_pair ($8CD71F) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  45 instructions (79 bytes)
 * - Compiled C ASM:   416 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   9.2x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      0e2fbf395d2c6b1f
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(script_op_ae_write_local_tile_pair, 0x8CD71F, RTS) {
    uint16_t tbase = dp_u16(r, 0x7E);
    uint16_t base = (uint16_t)(tbase + 0x000Fu);
    uint8_t off_x, off_y, hi, hi_out, v_flag;
    uint16_t sum_lo, x, y, tx, ty, val_x, val_y;

    off_x = R8(dp_u24(r, 0x82));
    dp_u16(r, 0x82) = (uint16_t)(dp_u16(r, 0x82) + 1u);
    sum_lo = (uint16_t)(base & 0x00FFu) + (uint16_t)off_x;
    hi = (uint8_t)(base >> 8);
    hi_out = (uint8_t)(hi + (sum_lo > 0xFFu ? 1u : 0u));
    x = ((uint16_t)hi_out << 8) | (sum_lo & 0x00FFu);

    off_y = R8(dp_u24(r, 0x82));
    dp_u16(r, 0x82) = (uint16_t)(dp_u16(r, 0x82) + 1u);
    sum_lo = (uint16_t)(base & 0x00FFu) + (uint16_t)off_y;
    hi = (uint8_t)(base >> 8);
    hi_out = (uint8_t)(hi + (sum_lo > 0xFFu ? 1u : 0u));
    v_flag = ((~(hi ^ 0x00u) & (hi ^ hi_out) & 0x80u) != 0) ? 1 : 0;
    y = ((uint16_t)hi_out << 8) | (sum_lo & 0x00FFu);

    tx = R16(dp_u24(r, 0x82));
    dp_u16(r, 0x82) = (uint16_t)(dp_u16(r, 0x82) + 1u);
    val_x = (uint16_t)((tx & 0x00FFu) << 3);
    bus_write16(r, x, val_x);

    ty = R16(dp_u24(r, 0x82));
    dp_u16(r, 0x82) = (uint16_t)(dp_u16(r, 0x82) + 1u);
    val_y = (uint16_t)((ty & 0x00FFu) << 3);
    bus_write16(r, y, val_y);

    r->a = val_y;
    r->x = x;
    r->y = y;
    soe_nz16(r, val_y);
    r->p = (r->p & ~(SOE_M | SOE_V)) | SOE_C | (v_flag ? SOE_V : 0);
}
