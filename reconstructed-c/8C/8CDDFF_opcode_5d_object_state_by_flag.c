/**
 * Routine: $8C:DDFF (script_op_5d_set_object_state_by_flag)
 * Bank: $8C (ROM Offset: $0CDDFF)
 * Calling convention: RTS
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_op_5d_set_object_state_by_flag ($8CDDFF) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  24 instructions (47 bytes)
 * - Compiled C ASM:   155 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   6.5x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      ec03402e88a9ae18
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(script_op_5d_set_object_state_by_flag, 0x8CDDFF, RTS);

void script_op_5d_set_object_state_by_flag_bind(soe_regs r) {
    soe_call_rtl(0x8CEA43u, r);
    uint16_t state = r->a;
    uint16_t flag_idx = LONG16(SOE_DPPTR(r, 0x82u));
    DP16(r, 0x82u) = (uint16_t)(DP16(r, 0x82u) + 2u);
    uint16_t byte_addr = (uint16_t)((flag_idx >> 3) + 0x2258u);
    r->y = byte_addr;
    uint16_t bit_idx = (uint16_t)(flag_idx & 0x0007u);
    r->x = bit_idx;
    uint16_t mask = (uint16_t)(ROM8(0x80A87Fu + bit_idx) & 0x00FFu);
    uint16_t val = (uint16_t)(mask & ABSI16(r, 0x0000u, r->y));
    if (val != 0u) {
        val = 0x007Fu;
    }
    r->a = val;
    r->x = state;
    soe_nz16(r, state);
    soe_call_rtl(0x90A36Du, r);
    soe_carry(r, true);
}
