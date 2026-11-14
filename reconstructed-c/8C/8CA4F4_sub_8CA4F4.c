/*
 * Routine: sub_8CA4F4 ($8C:A4F4)
 * Dialogue/Window subsystem: clears bit $0040 in word at $0012,Y.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sub_8CA4F4 ($8CA4F4) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  4 instructions (10 bytes)
 * - Compiled C ASM:   163 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   40.8x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      4321d185b1dc47e8
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(sub_8CA4F4, 0x8CA4F4, RTL) {
    if ((r->p & SOE_M) != 0u) {
        uint8_t val = (uint8_t)(ABSI8(r, 0x0012u, r->y) & 0xBFu);
        soe_set_a8(r, val);
        ABSI8(r, 0x0012u, r->y) = val;
        soe_nz8(r, val);
    } else {
        uint16_t val = (uint16_t)(ABSI16(r, 0x0012u, r->y) & 0xFFBFu);
        r->a = val;
        ABSI16(r, 0x0012u, r->y) = val;
        soe_nz16(r, val);
    }
}

