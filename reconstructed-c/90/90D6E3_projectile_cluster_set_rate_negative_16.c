/*
 * Routine: projectile_cluster_set_rate_negative_16 ($90:D6E3)
 * Set cluster tracking rate ($0F58) to $FFF0 (-16) and return C=1.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   projectile_cluster_set_rate_negative_16 ($90D6E3) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  4 instructions (8 bytes)
 * - Compiled C ASM:   41 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   10.3x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      a037e66a889a5128
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(projectile_cluster_set_rate_negative_16, 0x90D6E3, RTS) {
    ABS16(r, PROJECTILE_CLUSTER_TRACKING_RATE_ADDR) = 0xFFF0u;

    r->a = 0xFFF0u;
    soe_nz16(r, 0xFFF0u);
    soe_carry(r, true);
}

