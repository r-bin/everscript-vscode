/**
 * Routine: $8F:AA82 (entity_dispatch_waypoint_movement_with_collision_check)
 * Bank: $8F (ROM Offset: $0FAA82)
 * Calling convention: RTL
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   entity_dispatch_waypoint_movement_with_collision_check ($8FAA82) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  34 instructions (81 bytes)
 * - Compiled C ASM:   463 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   13.6x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      3180d7d9ccd071d2
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(entity_dispatch_waypoint_movement_with_collision_check, 0x8FAA82, RTL);

void entity_dispatch_waypoint_movement_with_collision_check_bind(soe_regs r) {
    uint8_t saved_db = r->db;
    r->db = 0x7Eu;
    uint16_t saved_a = r->a;
    r->x = DP16(r, 0x46u);
    r->y = DP16(r, 0x48u);
    soe_call_rtl(0x909815u, r);
    soe_call_rtl(0x8FA93Bu, r);
    soe_call_rtl(0x8F98B5u, r);
    r->a = saved_a;
    if (r->p & SOE_C) {
        ABSI16(r, 0x3C1Au, r->x) = saved_a;
        ABSI16(r, 0x3C18u, r->x) = DP16(r, 0x7Eu);
        soe_call_rtl(0x8FA7AAu, r);
        r->x = DP16(r, 0x4Eu);
        r->y = DP16(r, 0x4Cu);
        ABSI16(r, 0x0010u, r->y) |= 0x0020u;
        r->a = r->d;
        ABSI16(r, 0x0078u, r->y) = r->a;
        uint16_t plane = ABSI16(r, 0x0062u, r->y);
        r->a = plane;
        soe_cmp16(r, plane, ABSI16(r, 0x3BF9u, r->x));
        if (r->p & SOE_Z) {
            uint8_t z = ABSI8(r, 0x0018u, r->y);
            soe_set_a8(r, z);
            soe_cmp8(r, z, ABSI8(r, 0x3BFBu, r->x));
            if (r->p & SOE_Z) {
                soe_call_rtl(0x8FA8E2u, r);
            }
        }
    }
    r->db = saved_db;
    soe_nz8(r, saved_db);
}
