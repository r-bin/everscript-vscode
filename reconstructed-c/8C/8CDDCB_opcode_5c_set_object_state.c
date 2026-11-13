/**
 * Routine: $8C:DDCB (script_op_5c_set_object_state)
 * Bank: $8C (ROM Offset: $0CDDCB)
 * Calling convention: RTS
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_op_5c_set_object_state ($8CDDCB) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  7 instructions (16 bytes)
 * - Compiled C ASM:   51 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   7.3x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      aa19223f34cbf4ce
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(script_op_5c_set_object_state, 0x8CDDCB, RTS);

void script_op_5c_set_object_state_bind(soe_regs r) {
    soe_call_rtl(0x8CEA43u, r);
    uint16_t obj_idx = r->a;
    soe_call_rtl(0x8CEA43u, r);
    r->x = obj_idx;
    soe_nz16(r, obj_idx);
    soe_call_rtl(0x90A36Du, r);
    soe_carry(r, true);
}
