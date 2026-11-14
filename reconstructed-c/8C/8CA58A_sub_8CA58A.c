/*
 * Routine: sub_8CA58A ($8C:A58A)
 * Window/stream subsystem: adds accumulator to word at $0000,Y with carry.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sub_8CA58A ($8CA58A) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  3 instructions (7 bytes)
 * - Compiled C ASM:   137 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   45.7x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      1410a1164dc44359
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(sub_8CA58A, 0x8CA58A, RTL) {
    if ((r->p & SOE_M) != 0u) {
        uint8_t m = ABSI8(r, 0x0000u, r->y);
        uint8_t res = soe_adc8(r, SOE_A8(r), m);
        soe_set_a8(r, res);
        ABSI8(r, 0x0000u, r->y) = res;
    } else {
        uint16_t m = ABSI16(r, 0x0000u, r->y);
        r->a = soe_adc16(r, r->a, m);
        ABSI16(r, 0x0000u, r->y) = r->a;
    }
}

