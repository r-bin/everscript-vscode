/**
 * Routine: $8F:9D73 (sub_8F9D73)
 * Bank: $8F (ROM Offset: $0F9D73)
 * Calling convention: RTL
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sub_8F9D73 ($8F9D73) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  12 instructions (25 bytes)
 * - Compiled C ASM:   156 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   13.0x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      3eca141dfdecb964
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(sub_8F9D73, 0x8F9D73, RTL);

void sub_8F9D73_bind(soe_regs r) {
    uint8_t dir = SOE_A8(r);
    ABSI8(r, 0x0022u, r->y) = dir;
    if ((dir & 0x02u) == 0u) {
        soe_call_rts(0x8FA97Du, r);
    } else {
        uint8_t v = DP8(r, 0x12u);
        if (v & 0x80u) {
            v = (uint8_t)((uint8_t)(v - 1u) ^ 0xFFu);
        }
        soe_set_a8(r, v);
    }
    ABSI8(r, 0x0064u, r->y) = SOE_A8(r);
    soe_nz8(r, SOE_A8(r));
    r->p &= (uint8_t)~SOE_M;
}
