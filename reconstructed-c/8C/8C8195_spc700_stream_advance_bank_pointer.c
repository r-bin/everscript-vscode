/*
 * $8C:8195 spc700_stream_advance_bank_pointer (knowledge/routines/spc700_stream_advance_bank_pointer.md), RTS.
 *
 * Advances stream offset Y by 1; if it wraps to $0000, increments ROM bank in DP $A2 and resets Y = $8000.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   spc700_stream_advance_bank_pointer ($8C8195) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  5 instructions (9 bytes)
 * - Compiled C ASM:   130 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   26.0x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      619929f99bf134eb
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(spc700_stream_advance_bank_pointer, 0x8C8195, RTS)
{
    uint16_t y = (uint16_t)(r->y + 1u);
    if (y != 0) {
        r->y = y;
        r->p &= (uint8_t)~(SOE_N | SOE_Z);
        if (y & 0x8000u) {
            r->p |= SOE_N;
        }
        return;
    }

    if (r->p & SOE_M) {
        uint8_t bank = (uint8_t)(DP8(r, 0xA2) + 1u);
        DP8(r, 0xA2) = bank;
        soe_nz8(r, bank);
    } else {
        uint16_t bank = (uint16_t)(DP16(r, 0xA2) + 1u);
        DP16(r, 0xA2) = bank;
        soe_nz16(r, bank);
    }
    r->y = 0x8000u;
    r->p = (uint8_t)((r->p & ~SOE_Z) | SOE_N);
}

