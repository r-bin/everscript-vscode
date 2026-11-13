/**
 * Routine: $8F:B2DE (alloc_entity_slot_from_free_list_alt)
 * Bank: $8F (ROM Offset: $0FB2DE)
 * Calling convention: RTL
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   alloc_entity_slot_from_free_list_alt ($8FB2DE) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  27 instructions (64 bytes)
 * - Compiled C ASM:   345 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   12.8x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      f126774c70fc2036
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(alloc_entity_slot_from_free_list_alt, 0x8FB2DE, RTL);

void alloc_entity_slot_from_free_list_alt_bind(soe_regs r) {
    uint8_t saved_db = r->db;
    r->db = 0x7Eu;
    uint16_t sig = ABSI16(r, 0x0088u, r->y);
    r->x = sig;
    if (sig != 0u) {
        r->a = ABSI16(r, 0x008Au, r->y);
        soe_call_rtl(0x8CCFF4u, r);
        r->a = r->d;
        ABSI16(r, 0x0088u, r->y) = r->a;
        ABSI16(r, 0x008Au, r->y) = r->a;
    }
    soe_call_rtl(0x8FA8E2u, r);
    r->x = DP16(r, 0x4Cu);
    ABSI16(r, 0x002Au, r->x) = 0u;
    uint16_t refs = ABSI16(r, 0x003Eu, r->x);
    r->a = refs;
    if (refs == 0u) {
        soe_call_rtl(0x8FB31Eu, r);
    } else {
        uint16_t flags = ABSI16(r, 0x0010u, r->x);
        r->a = flags;
        if (flags & 0x0100u) {
            r->a = (uint16_t)(flags | 0x0008u);
            ABSI16(r, 0x0010u, r->y) = r->a;
            soe_call_rts(0x8FC514u, r);
        } else {
            r->p |= SOE_Z;
        }
    }
    r->db = saved_db;
    soe_nz8(r, saved_db);
}
