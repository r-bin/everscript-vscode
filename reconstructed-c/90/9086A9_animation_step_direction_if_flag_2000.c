/*
 * $90:86A9 animation_step_direction_if_flag_2000 (knowledge/routines/animation_step_direction_if_flag_2000.md), RTS, 8-bit A, 16-bit X, Y.
 *
 * Tests bit $2000 of entity surface flags +$3C,Y; when set, steps the entity along its facing direction
 * +$22,Y via $8F:AD51 and reloads Y from DP $4C. Returns with 8-bit accumulator.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   animation_step_direction_if_flag_2000 ($9086A9) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  11 instructions (26 bytes)
 * - Compiled C ASM:   152 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   13.8x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      ff9aeb219830c0a6
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(animation_step_direction_if_flag_2000, 0x9086A9, RTS)
{
    SOE_AT(0x86A9);
    r->p &= ~(SOE_M | SOE_X);
    r->a = ABSI16(r, 0x003C, r->y);
    soe_nz16(r, r->a);
    soe_bit_imm(r, r->a, 0x2000);
    if (!(r->p & SOE_Z)) {
        SOE_AT(0x86B3);
        DP16(r, 0x02) = 0;
        r->a = ABSI16(r, 0x0022, r->y);
        DP16(r, 0x04) = r->a;
        soe_call_rtl(0x8FAD51, r);
        r->y = DP16(r, 0x4C);
        soe_nz16(r, r->y);
    }
    SOE_AT(0x86C0);
    r->p |= SOE_M;
}
