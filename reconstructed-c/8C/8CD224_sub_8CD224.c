/*
 * Routine: sub_8CD224 ($8C:D224)
 * Script VM: calculates sleep target frame counter for active thread slot ($7E),
 * sets thread status to 4, and clears Carry; if sleep duration is 0, sets Carry.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sub_8CD224 ($8CD224) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  16 instructions (32 bytes)
 * - Compiled C ASM:   144 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   9.0x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      7a91aa5d4972ad51
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(sub_8CD224, 0x8CD224, RTS) {
    r->y = r->a;
    if (r->a == 0u) {
        soe_nz16(r, 0u);
        r->p |= SOE_C;
        return;
    }
    uint16_t thread_y = DP16(r, 0x7Eu);
    uint16_t a = (uint16_t)(r->a - 1u);
    soe_carry(r, false);
    uint16_t low = soe_adc16(r, a, RAM16(0x0B19u));
    ABSI16(r, 0x0005u, thread_y) = low;
    uint16_t high = soe_adc16(r, RAM16(0x0B1Bu), 0u);
    ABSI16(r, 0x0007u, thread_y) = high;
    ABSI16(r, 0x0003u, thread_y) = 0x0004u;
    r->a = 0x0004u;
    r->y = thread_y;
    soe_nz16(r, 0x0004u);
    r->p &= (uint8_t)~SOE_C;
}
