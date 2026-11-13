/*
 * $8F:9EA3 companion_waypoint_raycast_probe (knowledge/routines/companion_waypoint_raycast_probe.md), RTL, 8-bit A, 16-bit X, Y.
 *
 * Computes direction from (DP $66, $67) to (DP $69, $6A) via $8F:AA51, runs the metatile raycast
 * stepper $8F:9F05, and checks whether the reached elevation plane DP $44 matches target DP $6B.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   companion_waypoint_raycast_probe ($8F9EA3) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  18 instructions (32 bytes)
 * - Compiled C ASM:   228 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   12.7x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      8ec0c96183109cbb
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

void direction_index_from_signed_byte_pair_bind(soe_regs r);
void companion_metatile_raycast_line_stepper_bind(soe_regs r);

SOE_BIND(companion_waypoint_raycast_probe, 0x8F9EA3, RTL)
{
    SOE_AT(0x9EA3);
    r->p |= SOE_C;
    uint8_t dy = soe_sbc8(r, DP8(r, 0x6A), DP8(r, 0x67));
    r->p |= SOE_C;
    uint8_t dx = soe_sbc8(r, DP8(r, 0x69), DP8(r, 0x66));
    r->a = (uint16_t)(((uint16_t)dy << 8) | dx);

    direction_index_from_signed_byte_pair_bind(r);
    companion_metatile_raycast_line_stepper_bind(r);

    r->p |= SOE_M;
    if (r->p & SOE_C) {
        SOE_AT(0x9EB9);
        uint8_t a = DP8(r, 0x44);
        soe_set_a8(r, a);
        soe_cmp8(r, a, DP8(r, 0x6B));
        if (r->p & SOE_Z) {
            SOE_AT(0x9EBF);
            r->p |= SOE_C;
        } else {
            SOE_AT(0x9EC1);
            r->p &= ~SOE_C;
        }
    }
    SOE_AT(0x9EC2);
}
