/**
 * Routine: $8C:C543 (cutscene_pause_activate)
 * Bank: $8C (ROM Offset: $0CC543)
 * Calling convention: RTL
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   cutscene_pause_activate ($8CC543) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  12 instructions (26 bytes)
 * - Compiled C ASM:   147 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   12.3x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      a1c5d226b83a83c2
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(cutscene_pause_activate, 0x8CC543, RTL);

void cutscene_pause_activate_bind(soe_regs r) {
    uint16_t state = (uint16_t)(ABS16(r, 0x0B2Bu) & 0x7FFFu);
    r->a = state;
    if (state != 0u) {
        uint8_t saved_db = r->db;
        r->db = 0x8Cu;
        r->y = 0x034Du;
        soe_nz16(r, r->y);
        soe_call_rtl(0x8CADE5u, r);
        r->db = saved_db;
        soe_nz8(r, saved_db);
    }
    uint16_t old_val = ABS16(r, 0x0B2Bu);
    r->a = 0x8000u;
    r->p = (uint8_t)((r->p & ~SOE_Z) | SOE_N | ((old_val & 0x8000u) == 0u ? SOE_Z : 0));
    ABS16(r, 0x0B2Bu) = (uint16_t)(old_val | 0x8000u);
}
