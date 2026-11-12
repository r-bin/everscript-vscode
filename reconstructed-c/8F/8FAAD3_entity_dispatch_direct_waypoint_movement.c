/**
 * Routine: $8F:AAD3 (entity_dispatch_direct_waypoint_movement)
 * Bank: $8F (ROM Offset: $0FAAD3)
 * Calling convention: RTL
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   entity_dispatch_direct_waypoint_movement ($8FAAD3) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  25 instructions (56 bytes)
 * - Compiled C ASM:   262 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   10.5x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      569e36848d00bf47
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(entity_dispatch_direct_waypoint_movement, 0x8FAAD3, RTL);

void entity_dispatch_direct_waypoint_movement_bind(soe_regs r) {
    uint8_t saved_db = r->db;
    r->db = 0x7Eu;
    uint16_t saved_a = r->a;
    DP16(r, 0x44u) = 0u;
    soe_call_rtl(0x8F98B5u, r);
    r->a = saved_a;
    if (r->p & SOE_C) {
        ABSI16(r, 0x3C1Au, r->x) = saved_a;
        ABSI16(r, 0x3C18u, r->x) = DP16(r, 0x7Eu);
        soe_call_rtl(0x8FA7AAu, r);
        r->x = DP16(r, 0x4Eu);
        r->y = DP16(r, 0x4Cu);
        ABSI16(r, 0x3C12u, r->x) |= 0x0230u;
        ABSI16(r, 0x0010u, r->y) |= 0x0020u;
        r->a = r->d;
        soe_nz16(r, r->a);
        ABSI16(r, 0x0078u, r->y) = r->a;
    }
    r->db = saved_db;
    soe_nz8(r, saved_db);
}
