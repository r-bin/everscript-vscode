/**
 * Routine: $8F:9DA6 (sub_8F9DA6)
 * Bank: $8F (ROM Offset: $0F9DA6)
 * Calling convention: RTL
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sub_8F9DA6 ($8F9DA6) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  9 instructions (23 bytes)
 * - Compiled C ASM:   129 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   14.3x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      c141427f549dd8b3
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(sub_8F9DA6, 0x8F9DA6, RTL);

void sub_8F9DA6_bind(soe_regs r) {
    uint16_t child = DP16(r, 0x4Eu);
    r->x = ABSI16(r, 0x3C1Cu, child);
    r->a = ABSI16(r, 0x3C1Eu, child);
    r->y = DP16(r, 0x4Cu);
    soe_nz16(r, r->y);
    soe_call_rts(0x8F9DBDu, r);
    uint16_t state = ABSI16(r, 0x0064u, r->y);
    r->a = state;
    soe_nz16(r, state);
    if (state == 0u) {
        soe_call_rtl(0x8FA8E2u, r);
    }
}
