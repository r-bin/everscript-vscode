/*
 * Routine: sub_8CD291 ($8C:D291)
 * Script VM: sets thread slot state word at $0003,X to 0x0006 and clears Carry.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sub_8CD291 ($8CD291) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  4 instructions (8 bytes)
 * - Compiled C ASM:   108 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   27.0x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      fb18202106a446d3
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(sub_8CD291, 0x8CD291, RTS) {
    if ((r->p & SOE_M) != 0u) {
        soe_set_a8(r, 0x06u);
        ABSI8(r, 0x0003u, r->x) = 0x06u;
        soe_nz8(r, 0x06u);
    } else {
        r->a = 0x0006u;
        ABSI16(r, 0x0003u, r->x) = 0x0006u;
        soe_nz16(r, 0x0006u);
    }
    r->p &= (uint8_t)~SOE_C;
}

