/**
 * Routine: $8C:DA0A (script_op_51_text)
 * Bank: $8C (ROM Offset: $0CDA0A)
 * Calling convention: RTS
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_op_51_text ($8CDA0A) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  15 instructions (30 bytes)
 * - Compiled C ASM:   156 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   10.4x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      5c30ba6e29f829cd
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(script_op_51_text, 0x8CDA0A, RTS);

void script_op_51_text_bind(soe_regs r) {
    uint8_t saved_db = r->db;
    r->db = 0x80u;
    DP16(r, 0x8Eu) = 0x034Du;
    uint16_t text_id = LONG16(SOE_DPPTR(r, 0x82u));
    DP16(r, 0x82u) = (uint16_t)(DP16(r, 0x82u) + 2u);
    r->a = text_id;
    soe_nz16(r, text_id);
    soe_call_rtl(0x8CCCF5u, r);
    r->y = DP16(r, 0x8Eu);
    soe_nz16(r, r->y);
    soe_call_rtl(0x8C9E03u, r);
    r->db = saved_db;
    soe_nz8(r, saved_db);
    soe_carry(r, true);
}
