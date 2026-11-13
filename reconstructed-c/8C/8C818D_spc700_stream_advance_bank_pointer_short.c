/*
 * $8C:818D spc700_stream_advance_bank_pointer_short (knowledge/routines/spc700_stream_advance_bank_pointer_short.md), RTS.
 *
 * Advances stream offset Y by 2 across 64KB ROM bank boundaries (two consecutive pointer steps).
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   spc700_stream_advance_bank_pointer_short ($8C818D) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  9 instructions (17 bytes)
 * - Compiled C ASM:   60 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   6.7x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      c0885d927b2fdfd9
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

void spc700_stream_advance_bank_pointer_bind(soe_regs r);

SOE_BIND(spc700_stream_advance_bank_pointer_short, 0x8C818D, RTS)
{
    uint16_t y = (uint16_t)(r->y + 1u);
    if (y != 0) {
        r->y = y;
        spc700_stream_advance_bank_pointer_bind(r);
        return;
    }

    if (r->p & SOE_M) {
        DP8(r, 0xA2) = (uint8_t)(DP8(r, 0xA2) + 1u);
    } else {
        DP16(r, 0xA2) = (uint16_t)(DP16(r, 0xA2) + 1u);
    }
    r->y = 0x8000u;
    spc700_stream_advance_bank_pointer_bind(r);
}

