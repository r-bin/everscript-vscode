/**
 * Routine: $8C:DEF5 (script_op_75_face_8)
 * Bank: $8C (ROM Offset: $0CDEF5)
 * Calling convention: RTS
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_op_75_face_8 ($8CDEF5) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  5 instructions (12 bytes)
 * - Compiled C ASM:   61 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   12.2x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      f6bf3036f1d9fe7a
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(script_op_75_face_8, 0x8CDEF5, RTS);

void script_op_75_face_8_bind(soe_regs r) {
    soe_call_rtl(0x8CEC8Eu, r);
    r->a = 0x0008u;
    soe_nz16(r, r->a);
    ABSI16(r, 0x0022u, r->y) = r->a;
    soe_carry(r, true);
}
