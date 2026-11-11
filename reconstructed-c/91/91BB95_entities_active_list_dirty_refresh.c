/*
 * $91:BB95 entities_active_list_dirty_refresh (knowledge/routines/entities_active_list_dirty_refresh.md), RTL, 16-bit A, X, Y.
 *
 * Sets DB = $7E, calls $90:C9FC, and when $0FB2 is non-zero clears it and iterates the active entity
 * list from $3DDF calling $91:BBB7 on each node.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   entities_active_list_dirty_refresh ($91BB95) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  16 instructions (34 bytes)
 * - Compiled C ASM:   156 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   9.8x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      a7b65c7c1145f15e
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(entities_active_list_dirty_refresh, 0x91BB95, RTL)
{
    uint8_t entry_db = r->db;

    SOE_AT(0xBB95);
    r->db = 0x7E;
    soe_call_rtl(0x90C9FC, r);
    r->a = ABS16(r, STATUS_EFFECTS_FRAME_COUNTER_ADDR);
    if (r->a != 0) {
        SOE_AT(0xBBA4);
        ABS16(r, STATUS_EFFECTS_FRAME_COUNTER_ADDR) = 0;
        r->y = ABS16(r, ACTIVE_ENTITY_HEAD_ADDR);
        for (;;) {
            SOE_AT(0xBBAA);
            soe_call_rts(0x91BBB7, r);
            r->a = ABSI16(r, 0x005E, r->y);
            if (r->a == 0) break;
            SOE_AT(0xBBB2);
            r->y = r->a;
        }
    }
    SOE_AT(0xBBB5);
    r->db = entry_db;
    soe_nz8(r, entry_db);
}
