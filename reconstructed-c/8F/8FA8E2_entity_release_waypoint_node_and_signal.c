/**
 * Routine: $8F:A8E2 (entity_release_waypoint_node_and_signal)
 * Bank: $8F (ROM Offset: $0FA8E2)
 * Calling convention: RTL
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sub_8FA8C0 ($8FA8C0) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  14 instructions (34 bytes)
 * - Compiled C ASM:   259 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   18.5x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      1fc619fc1b88f8ef
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

SOE_BIND(sub_8FA8C0, 0x8FA8C0, RTL) {
    uint16_t a = r->y;
    r->a = a;
    soe_nz16(r, a);
    uint16_t target = ABSI16(r, 0x006Cu, r->x);
    soe_cmp16(r, a, target);
    if (a == target) {
        entity_release_waypoint_node_and_signal_bind(r);
        return;
    }
    soe_carry(r, false);
    a = soe_adc16(r, a, 0x0003u);
    r->a = a;
    ABSI16(r, 0x3BFFu, r->y) = a;
    ABSI16(r, 0x3C10u, r->y) = 0xFFFFu;
    ABSI16(r, 0x3BC9u, r->y) = DP16(r, 0x66u);
    uint16_t val67 = DP16(r, 0x67u);
    ABSI16(r, 0x3BCAu, r->y) = val67;
    r->a = val67;
    soe_nz16(r, val67);
}
