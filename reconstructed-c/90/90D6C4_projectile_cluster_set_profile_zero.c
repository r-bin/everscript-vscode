/*
 * Routine: projectile_cluster_set_profile_zero ($90:D6C4)
 * Reset cluster tracking distance/velocity ($0F54, $0F56) to 0, set rate
 * ($0F58) to 8, and return C=1.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   projectile_cluster_set_profile_zero ($90D6C4) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  6 instructions (14 bytes)
 * - Compiled C ASM:   73 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   12.2x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      bd9d23b6cf046e61
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(projectile_cluster_set_profile_zero, 0x90D6C4, RTS) {
    ABS16(r, PROJECTILE_CLUSTER_TRACKING_DIST_ADDR) = 0x0000u;
    ABS16(r, PROJECTILE_CLUSTER_TRACKING_VELOCITY_ADDR) = 0x0000u;
    ABS16(r, PROJECTILE_CLUSTER_TRACKING_RATE_ADDR) = 0x0008u;

    r->a = 0x0008u;
    soe_nz16(r, 0x0008u);
    soe_carry(r, true);
}

