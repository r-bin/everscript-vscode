/**
 * Routine: $8C:E6CF (script_op_9a_font)
 * Bank: $8C (ROM Offset: $0CE6CF)
 * Calling convention: RTS
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_op_9a_font ($8CE6CF) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  12 instructions (23 bytes)
 * - Compiled C ASM:   79 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   6.6x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      0ee49724576a3484
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(script_op_9a_font, 0x8CE6CF, RTS);

void script_op_9a_font_bind(soe_regs r) {
    soe_call_rtl(0x8CEA43u, r);
    r->x = r->a;
    r->a = ROM16(0x8CE6E6u + r->x);
    r->x = r->a;
    uint8_t saved_db = r->db;
    r->db = 0x80u;
    soe_nz8(r, 0x80u);
    soe_call_rtl(0x8C9DAFu, r);
    r->db = saved_db;
    soe_nz8(r, saved_db);
    soe_carry(r, true);
}
