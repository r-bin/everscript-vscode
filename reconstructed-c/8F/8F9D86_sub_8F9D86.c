/*
 * Routine: sub_8F9D86 ($8F:9D86)
 * Store accumulator byte into entity/animation field $0064,Y and widen A to
 * 16-bit mode (REP #$20) before returning via RTL.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sub_8F9D86 ($8F9D86) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  3 instructions (6 bytes)
 * - Compiled C ASM:   71 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   23.7x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      b62f1d616d1bf02c
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(sub_8F9D86, 0x8F9D86, RTL) {
    if ((r->p & SOE_M) != 0u) {
        ABSI8(r, 0x0064u, r->y) = SOE_A8(r);
    } else {
        ABSI16(r, 0x0064u, r->y) = r->a;
    }
    r->p &= (uint8_t)~SOE_M;
}

