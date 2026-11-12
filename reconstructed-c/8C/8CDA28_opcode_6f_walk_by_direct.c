/*
 * $8C:DA28 — script_op_6f_walk_by_direct (RTS)
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_op_6f_walk_by_direct ($8CDA28) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  42 instructions (85 bytes)
 * - Compiled C ASM:   236 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   5.6x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      6c18483236da9c68
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(script_op_6f_walk_by_direct, 0x8CDA28, RTS);
void script_op_6f_walk_by_direct_bind(soe_regs r)
{
    DP16(r, 0x12) = 1u;
    soe_call_rtl(0x8CEC8Eu, r);

    soe_call_rtl(0x8CEA43u, r);
    uint16_t dx = (uint16_t)(r->a << 4);

    soe_call_rtl(0x8CEA43u, r);
    uint16_t dy = (uint16_t)(r->a << 4);
    DP16(r, 0x48) = dy;
    DP16(r, 0x46) = dx;

    r->y = DP16(r, 0x4C);
    r->p &= (uint8_t)~SOE_C;
    DP16(r, 0x46) = soe_adc16(r, RAM16(r->y + 0x001Au), dx);
    r->p &= (uint8_t)~SOE_C;
    DP16(r, 0x48) = soe_adc16(r, RAM16(r->y + 0x001Cu), dy);

    r->y = DP16(r, 0x4C);
    if (r->y < 0x4E89u && RAM16(r->y + 0x002Au) == 0) {
        r->a = 0;
        soe_nz16(r, 0);
        r->p |= SOE_C;
        return;
    }

    r->a = 0;
    r->y = DP16(r, 0x12);
    if (r->y != 0) {
        soe_call_rtl(0x8FAAD3u, r);
    } else {
        soe_call_rtl(0x8FAA82u, r);
    }
    r->p |= SOE_C;
}
