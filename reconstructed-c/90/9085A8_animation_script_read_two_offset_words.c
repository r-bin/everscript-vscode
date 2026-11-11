/*
 * Routine: animation_script_read_two_offset_words ($90:85A8)
 * Read two 16-bit offset words from [$5D], store them into record fields
 * $0042,Y and $0044,Y, advance $5D by 4, and restore 8-bit accumulator mode.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   animation_script_read_two_offset_words ($9085A8) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  14 instructions (25 bytes)
 * - Compiled C ASM:   157 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   11.2x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      289e0de3145c9d3c
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(animation_script_read_two_offset_words, 0x9085A8, RTS) {
    uint16_t ptr_lo;
    uint32_t bank;
    uint16_t w0;
    uint16_t w1;

    /* REP #$20: X is already 16-bit on entry */
    ptr_lo = DP16(r, 0x5Du);
    bank = (uint32_t)DP8(r, 0x5Fu) << 16;

    w0 = LONG16(bank | ptr_lo);
    ABSI16(r, 0x0042u, r->y) = w0;
    ptr_lo = (uint16_t)(ptr_lo + 2u);
    DP16(r, 0x5Du) = ptr_lo;

    w1 = LONG16(bank | ptr_lo);
    ABSI16(r, 0x0044u, r->y) = w1;
    ptr_lo = (uint16_t)(ptr_lo + 2u);
    DP16(r, 0x5Du) = ptr_lo;

    r->a = w1;
    r->x = ptr_lo;
    /* INX; INX sets 16-bit N/Z on final X; SEP #$20 sets M */
    soe_nz16(r, ptr_lo);
    r->p |= SOE_M;
}

