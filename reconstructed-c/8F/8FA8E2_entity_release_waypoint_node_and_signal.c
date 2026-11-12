/**
 * Routine: $8F:A8E2 (entity_release_waypoint_node_and_signal)
 * Bank: $8F (ROM Offset: $0FA8E2)
 * Calling convention: RTL
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   entity_release_waypoint_node_and_signal ($8FA8E2) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  16 instructions (42 bytes)
 * - Compiled C ASM:   246 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   15.4x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      a097f94b843e655c
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(entity_release_waypoint_node_and_signal, 0x8FA8E2, RTL);

void entity_release_waypoint_node_and_signal_bind(soe_regs r) {
    r->y = DP16(r, 0x4Cu);
    uint16_t node = ABSI16(r, 0x006Cu, r->y);
    r->x = node;
    if ((node & 0x8000u) == 0u) {
        uint16_t sig = ABSI16(r, 0x3C1Au, node);
        r->a = sig;
        if (sig != 0u) {
            r->x = ABSI16(r, 0x3C18u, node);
            soe_call_rtl(0x8CCFF4u, r);
            r->y = DP16(r, 0x4Cu);
            r->x = ABSI16(r, 0x006Cu, r->y);
        }
        soe_call_rtl(0x8F9916u, r);
        ABSI16(r, 0x006Cu, r->y) = r->a;
    }
    uint16_t flags = (uint16_t)(ABSI16(r, 0x0014u, r->y) & 0xF7FFu);
    r->a = flags;
    ABSI16(r, 0x0014u, r->y) = flags;
    soe_nz16(r, flags);
}
