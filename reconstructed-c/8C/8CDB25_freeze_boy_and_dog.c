/*
 * $8C:DB25 freeze_boy_and_dog (knowledge/routines/freeze_boy_and_dog.md), RTS, 16-bit A, X, Y.
 *
 * Loads $0003 into A (selecting both the boy and dog bits) and falls into the shared
 * party-freeze body at $8C:DB31, which calls $8F:CD78 (entity_freeze_immobilize) on
 * the boy ($4E89) and dog ($4F37) entities and returns with carry set.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   freeze_boy_and_dog ($8CDB25) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  27 instructions (59 bytes)
 * - Compiled C ASM:   224 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   8.3x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      7d35980b492b1915
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(freeze_boy_and_dog, 0x8CDB25, RTS)
{
    SOE_AT(0xDB25);
    r->a = 0x0003;
    SOE_AT(0xDB28);
    SOE_AT(0xDB31);
    if ((r->a & 0x0008) == 0) r->p |= SOE_Z; else r->p &= ~SOE_Z;
    if ((r->a & 0x0008) != 0) {
        SOE_AT(0xDB36);
        r->x = DP16(r, 0x7E);
        r->y = ABSI16(r, 0x000D, r->x);
        soe_nz16(r, r->y);
        if (r->y != 0) {
            uint16_t saved_a = r->a;
            DP16(r, 0x4C) = r->y;
            soe_call_rtl(0x8FCD78UL, r);
            r->a = saved_a;
            soe_nz16(r, r->a);
        }
    }
    SOE_AT(0xDB45);
    if ((r->a & 0x0001) == 0) r->p |= SOE_Z; else r->p &= ~SOE_Z;
    if ((r->a & 0x0001) != 0) {
        uint16_t saved_a = r->a;
        SOE_AT(0xDB4B);
        r->y = 0x4E89;
        DP16(r, 0x4C) = r->y;
        soe_call_rtl(0x8FCD78UL, r);
        r->a = saved_a;
        soe_nz16(r, r->a);
    }
    SOE_AT(0xDB55);
    if ((r->a & 0x0002) == 0) r->p |= SOE_Z; else r->p &= ~SOE_Z;
    if ((r->a & 0x0002) != 0) {
        uint16_t saved_a = r->a;
        SOE_AT(0xDB5B);
        r->y = 0x4F37;
        DP16(r, 0x4C) = r->y;
        soe_call_rtl(0x8FCD78UL, r);
        r->a = saved_a;
        soe_nz16(r, r->a);
    }
    SOE_AT(0xDB65);
    soe_carry(r, true);
}
