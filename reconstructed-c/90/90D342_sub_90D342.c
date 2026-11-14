/*
 * Routine: sub_90D342 ($90:D342)
 * Palette/Graphics subsystem: packs accumulator bits and ORs direct page $1C.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sub_90D342 ($90D342) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  6 instructions (10 bytes)
 * - Compiled C ASM:   47 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   7.8x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      055745ea25154e2b
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(sub_90D342, 0x90D342, RTL) {
    r->p &= (uint8_t)~(SOE_M | SOE_X);
    uint16_t a = (uint16_t)(((r->a & 0x00F8u) << 2) | DP16(r, 0x1Cu));
    r->a = a;
    soe_nz16(r, a);
    soe_carry(r, false);
}

