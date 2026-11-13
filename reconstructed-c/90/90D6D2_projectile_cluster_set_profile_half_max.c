/*
 * Routine: projectile_cluster_set_profile_half_max ($90:D6D2)
 * Set cluster tracking distance ($0F54) to $7FFF, clear velocity ($0F56),
 * set rate ($0F58) to $0010, and return C=1.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   projectile_cluster_set_profile_half_max ($90D6D2) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  7 instructions (17 bytes)
 * - Compiled C ASM:   73 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   10.4x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      3124c81202a87d76
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(projectile_cluster_set_profile_half_max, 0x90D6D2, RTS) {
    ABS16(r, PROJECTILE_CLUSTER_TRACKING_DIST_ADDR) = 0x7FFFu;
    ABS16(r, PROJECTILE_CLUSTER_TRACKING_VELOCITY_ADDR) = 0x0000u;
    ABS16(r, PROJECTILE_CLUSTER_TRACKING_RATE_ADDR) = 0x0010u;

    r->a = 0x0010u;
    soe_nz16(r, 0x0010u);
    soe_carry(r, true);
}

