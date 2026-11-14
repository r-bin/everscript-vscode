/*
 * Routine: sub_90DE7B ($90:DE7B)
 * Projectile subsystem: clears projectile field $0010,Y using TDC (D = 0).
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sub_90DE7B ($90DE7B) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  3 instructions (5 bytes)
 * - Compiled C ASM:   84 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   28.0x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      2feb431d790d0956
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(sub_90DE7B, 0x90DE7B, RTS) {
    r->a = r->d;
    soe_nz16(r, r->a);
    if ((r->p & SOE_M) != 0u) {
        ABSI8(r, 0x0010u, r->y) = SOE_A8(r);
    } else {
        ABSI16(r, 0x0010u, r->y) = r->a;
    }
}

