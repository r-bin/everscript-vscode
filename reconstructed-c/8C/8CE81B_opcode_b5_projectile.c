/**
 * Routine: $8C:E81B (configure_projectile_motion)
 * Bank: $8C (ROM Offset: $0CE81B)
 * Calling convention: RTS
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   configure_projectile_motion ($8CE81B) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  28 instructions (66 bytes)
 * - Compiled C ASM:   189 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   6.8x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      aef8f72ebd2ad65d
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(configure_projectile_motion, 0x8CE81B, RTS);

void configure_projectile_motion_bind(soe_regs r) {
    soe_call_rtl(0x8CEA43u, r);
    uint16_t arg1 = r->a;
    soe_call_rtl(0x8CEA43u, r);
    uint16_t arg2 = r->a;
    soe_call_rtl(0x8CEA43u, r);
    DP16(r, 0x46u) = r->a;
    soe_call_rtl(0x8CEA43u, r);
    DP16(r, 0x48u) = r->a;
    soe_call_rtl(0x8CEA43u, r);
    DP16(r, 0x4Au) = r->a;
    soe_call_rtl(0x8CEA43u, r);
    uint16_t arg6 = r->a;
    soe_call_rtl(0x8CEA43u, r);
    uint16_t arg7 = r->a;
    soe_call_rtl(0x8CEA43u, r);
    DP16(r, 0x08u) = r->a;
    DP16(r, 0x04u) = arg7;
    DP16(r, 0x02u) = arg6;
    DP16(r, 0x4Cu) = arg2;
    r->x = arg1;
    uint16_t spd = ROM16(0x90D986u + arg1);
    r->a = spd;
    soe_nz16(r, spd);
    DP16(r, 0x06u) = spd;
    soe_call_rtl(0x90DCC0u, r);
    soe_carry(r, true);
}
