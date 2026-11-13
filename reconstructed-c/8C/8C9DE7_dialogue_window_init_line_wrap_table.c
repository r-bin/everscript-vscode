/*
 * $8C:9DE7 dialogue_window_init_line_wrap_table (knowledge/routines/dialogue_window_init_line_wrap_table.md), RTL, 16-bit A, X, Y.
 *
 * Fills the 16-byte dialogue line wrap table at $7E:2000..$7E:200F with descending thresholds
 * ($0F, $1F, ..., $FF) in 8-bit accumulator mode.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   dialogue_window_init_line_wrap_table ($8C9DE7) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  9 instructions (19 bytes)
 * - Compiled C ASM:   97 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   10.8x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      8a85ddb2d6b77f52
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(dialogue_window_init_line_wrap_table, 0x8C9DE7, RTL)
{
    SOE_AT(0x9DE7);
    r->p |= (SOE_M | SOE_C);
    r->x = 0x000F;
    soe_set_a8(r, 0xFF);
    do {
        SOE_AT(0x9DEE);
        LONG8(0x7E2000UL + r->x) = SOE_A8(r);
        soe_set_a8(r, soe_sbc8(r, SOE_A8(r), 0x10));
        r->x = (uint16_t)(r->x - 1);
        soe_nz16(r, r->x);
    } while (!(r->p & SOE_N));
    SOE_AT(0x9DF7);
    r->p &= ~SOE_M;
}
