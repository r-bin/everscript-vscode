/*
 * Routine: sub_8CD781 ($8C:D781)
 * Script VM: reads two 8-bit operands from script PC ($82), shifts each left by 3,
 * stores to $0000,X and $0000,Y, and sets Carry.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sub_8CD781 ($8CD781) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  16 instructions (28 bytes)
 * - Compiled C ASM:   185 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   11.6x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      13616e7dff31c927
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(sub_8CD781, 0x8CD781, RTS) {
    uint32_t ptr1 = SOE_DPPTR(r, 0x82u);
    uint16_t b1 = (uint16_t)((LONG8(ptr1) & 0x00FFu) << 3);
    DP16(r, 0x82u) = (uint16_t)(DP16(r, 0x82u) + 1u);
    ABSI16(r, 0x0000u, r->x) = b1;

    uint32_t ptr2 = SOE_DPPTR(r, 0x82u);
    uint16_t b2 = (uint16_t)((LONG8(ptr2) & 0x00FFu) << 3);
    DP16(r, 0x82u) = (uint16_t)(DP16(r, 0x82u) + 1u);
    ABSI16(r, 0x0000u, r->y) = b2;

    r->a = b2;
    soe_nz16(r, b2);
    r->p |= SOE_C;
}

