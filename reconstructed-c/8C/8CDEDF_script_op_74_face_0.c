/**
 * Routine: $8C:DEDF (script_op_74_face_0)
 * Bank: $8C (ROM Offset: $0CDEDF)
 * Calling convention: RTS
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_op_74_face_0 ($8CDEDF) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  5 instructions (10 bytes)
 * - Compiled C ASM:   62 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   12.4x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      6380f7f811dd366e
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(script_op_74_face_0, 0x8CDEDF, RTS);

void script_op_74_face_0_bind(soe_regs r) {
    soe_call_rtl(0x8CEC8Eu, r);
    r->a = r->d;
    soe_nz16(r, r->a);
    ABSI16(r, 0x0022u, r->y) = r->a;
    soe_carry(r, true);
}
