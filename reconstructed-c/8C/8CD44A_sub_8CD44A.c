/*
 * Routine: sub_8CD44A ($8C:D44A)
 * Script VM: calculates branch destination offset into DP $82/$84 and sets Carry.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sub_8CD44A ($8CD44A) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  7 instructions (13 bytes)
 * - Compiled C ASM:   91 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   13.0x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      dd5dfc779375bfc4
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(sub_8CD44A, 0x8CD44A, RTS) {
    uint16_t sum = soe_adc16(r, r->a, DP16(r, 0x82u));
    if ((r->p & SOE_N) != 0u) {
        DP16(r, 0x82u) = sum;
        r->a = sum;
    } else {
        sum |= 0x8000u;
        uint16_t d84 = (uint16_t)(DP16(r, 0x84u) - 1u);
        DP16(r, 0x84u) = d84;
        soe_nz16(r, d84);
        DP16(r, 0x82u) = sum;
        r->a = sum;
    }
    r->p |= SOE_C;
}
