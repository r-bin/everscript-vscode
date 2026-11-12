/**
 * Routine: $8C:DF01 (script_op_76_face_12)
 * Bank: $8C (ROM Offset: $0CDF01)
 * Calling convention: RTS
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_op_76_face_12 ($8CDF01) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  5 instructions (12 bytes)
 * - Compiled C ASM:   61 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   12.2x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      1cea75211537d7cc
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(script_op_76_face_12, 0x8CDF01, RTS);

void script_op_76_face_12_bind(soe_regs r) {
    soe_call_rtl(0x8CEC8Eu, r);
    r->a = 0x000Cu;
    soe_nz16(r, r->a);
    ABSI16(r, 0x0022u, r->y) = r->a;
    soe_carry(r, true);
}
