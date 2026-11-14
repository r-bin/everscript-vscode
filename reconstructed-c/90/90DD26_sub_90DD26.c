/*
 * Routine: sub_90DD26 ($90:DD26)
 * Projectile subsystem: sets duration/timer field $0026,Y to 0x0014 (20 frames).
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sub_90DD26 ($90DD26) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  3 instructions (7 bytes)
 * - Compiled C ASM:   88 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   29.3x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      f63652df07b85bb4
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(sub_90DD26, 0x90DD26, RTL) {
    if ((r->p & SOE_M) != 0u) {
        soe_set_a8(r, 0x14u);
        ABSI8(r, 0x0026u, r->y) = 0x14u;
        soe_nz8(r, 0x14u);
    } else {
        r->a = 0x0014u;
        ABSI16(r, 0x0026u, r->y) = 0x0014u;
        soe_nz16(r, 0x0014u);
    }
}

