/*
 * Routine: projectile_cluster_sync_master_id ($90:D68F)
 * Sync master entity ID $0F52 from projectile slot $0EE1,Y; if changed, clear
 * $0ECA,X in all 4 projectile slots ($51, $36, $1B, $00) with mismatched $0EE1,X,
 * then initialize tracking fields ($0F54, $0F56 = 1, $0F58 = $FFFF).
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   projectile_cluster_sync_master_id ($90D68F) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  22 instructions (53 bytes)
 * - Compiled C ASM:   266 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   12.1x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      7eb2d3e050d4faee
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(projectile_cluster_sync_master_id, 0x90D68F, RTS) {
    uint16_t master = ABSI16(r, 0x0EE1u, r->y);

    soe_cmp16(r, master, ABS16(r, PROJECTILE_CLUSTER_MASTER_ENTITY_ADDR));
    if ((r->p & SOE_Z) == 0u) {
        uint16_t x = 0x0051u;
        ABS16(r, PROJECTILE_CLUSTER_MASTER_ENTITY_ADDR) = master;
        for (;;) {
            uint16_t slot_id = ABSI16(r, 0x0EE1u, x);
            soe_cmp16(r, slot_id, ABS16(r, PROJECTILE_CLUSTER_MASTER_ENTITY_ADDR));
            if ((r->p & SOE_Z) == 0u) {
                ABSI16(r, 0x0ECAu, x) = 0x0000u;
            }
            soe_carry(r, true);
            x = soe_sbc16(r, x, 0x001Bu);
            if ((r->p & SOE_N) != 0u) {
                break;
            }
        }
        r->x = x;
        master = ABS16(r, PROJECTILE_CLUSTER_MASTER_ENTITY_ADDR);
    }

    ABS16(r, PROJECTILE_CLUSTER_TRACKING_DIST_ADDR) = master;
    ABS16(r, PROJECTILE_CLUSTER_TRACKING_VELOCITY_ADDR) = 0x0001u;
    ABS16(r, PROJECTILE_CLUSTER_TRACKING_RATE_ADDR) = 0xFFFFu;

    r->a = 0xFFFFu;
    soe_nz16(r, 0xFFFFu);
    soe_carry(r, true);
}

