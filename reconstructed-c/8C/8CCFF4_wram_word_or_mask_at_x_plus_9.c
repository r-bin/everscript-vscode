/*
 * $8C:CFF4 wram_word_or_mask_at_x_plus_9 (knowledge/routines/wram_word_or_mask_at_x_plus_9.md), RTL.
 *
 * ORs accumulator A into the 16-bit WRAM word at $7E:0009 + X.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   wram_word_or_mask_at_x_plus_9 ($8CCFF4) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  3 instructions (9 bytes)
 * - Compiled C ASM:   38 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   12.7x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      b9e7e8da4d35f0f9
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(wram_word_or_mask_at_x_plus_9, 0x8CCFF4, RTL)
{
    uint32_t addr = 0x7E0009UL + r->x;
    uint16_t val = (uint16_t)(LONG16(addr) | r->a);
    LONG16(addr) = val;
    r->a = val;
    soe_nz16(r, val);
}

