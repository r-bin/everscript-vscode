/**
 * Routine: $8C:DD4B (script_op_3d_attach_talk_script)
 * Bank: $8C (ROM Offset: $0CDD4B)
 * Calling convention: RTS
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_op_3d_attach_talk_script ($8CDD4B) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  9 instructions (21 bytes)
 * - Compiled C ASM:   139 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   15.4x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      15689c9cce435c30
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(script_op_3d_attach_talk_script, 0x8CDD4B, RTS);

void script_op_3d_attach_talk_script_bind(soe_regs r) {
    soe_call_rtl(0x8CEC8Eu, r);
    uint16_t script_id = LONG16(SOE_DPPTR(r, 0x82u));
    DP16(r, 0x82u) = (uint16_t)(DP16(r, 0x82u) + 2u);
    ABSI16(r, 0x0066u, r->y) = script_id;
    r->a = 0x0040u;
    soe_nz16(r, r->a);
    ABSI16(r, 0x0068u, r->y) = r->a;
    soe_carry(r, true);
}
