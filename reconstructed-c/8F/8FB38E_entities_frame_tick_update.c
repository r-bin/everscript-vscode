/**
 * Routine: $8F:B38E (entities_frame_tick_update)
 * Bank: $8F (ROM Offset: $0FB38E)
 * Calling convention: RTL
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   entities_frame_tick_update ($8FB38E) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  28 instructions (70 bytes)
 * - Compiled C ASM:   205 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   7.3x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      8bc962cc3fae6df3
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(entities_frame_tick_update, 0x8FB38E, RTL);

void entities_frame_tick_update_bind(soe_regs r) {
    uint8_t saved_db = r->db;
    r->db = 0x7Eu;
    ABS16(r, 0x0F44u) = 0u;
    r->y = 0x4E89u;
    r->x = ABS16(r, 0x0A58u);
    soe_call_rts(0x8FB3D4u, r);
    r->y = 0x4F37u;
    r->x = ABS16(r, 0x0AA2u);
    soe_call_rts(0x8FB3D4u, r);
    uint16_t ent = 0x3DE5u;
    for (;;) {
        DP16(r, 0x4Cu) = ent;
        r->y = ent;
        uint16_t flags = ABSI16(r, 0x0010u, ent);
        if (flags & 0x0300u) {
            soe_call_rtl(0x8FB31Eu, r);
        }
        ent = (uint16_t)(DP16(r, 0x4Cu) + 0x008Eu);
        if (ent >= 0x4E89u) {
            break;
        }
    }
    soe_call_rtl(0x90D7CBu, r);
    soe_call_rtl(0x8FDF14u, r);
    soe_call_rtl(0x90DC21u, r);
    r->db = saved_db;
    soe_nz8(r, saved_db);
}
