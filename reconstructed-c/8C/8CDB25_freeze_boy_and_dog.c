/*
 * $8C:DB25 freeze_boy_and_dog (knowledge/routines/freeze_boy_and_dog.md), RTS, 16-bit A, X, Y.
 *
 * Loads $0003 into A (selecting both the boy and dog bits) and falls into the shared
 * party-freeze body at $8C:DB31, which calls $8F:CD78 (entity_freeze_immobilize) on
 * the boy ($4E89) and dog ($4F37) entities and returns with carry set.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sub_8CDB31 ($8CDB31) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  25 instructions (54 bytes)
 * - Compiled C ASM:   226 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   9.0x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      78112b678de27628
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(sub_8CDB31, 0x8CDB31, RTS)
{
    if ((r->a & 0x0008) == 0) r->p |= SOE_Z; else r->p &= ~SOE_Z;
    if ((r->a & 0x0008) != 0) {
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
    if ((r->a & 0x0001) == 0) r->p |= SOE_Z; else r->p &= ~SOE_Z;
    if ((r->a & 0x0001) != 0) {
        uint16_t saved_a = r->a;
        r->y = 0x4E89;
        DP16(r, 0x4C) = r->y;
        soe_call_rtl(0x8FCD78UL, r);
        r->a = saved_a;
        soe_nz16(r, r->a);
    }
    if ((r->a & 0x0002) == 0) r->p |= SOE_Z; else r->p &= ~SOE_Z;
    if ((r->a & 0x0002) != 0) {
        uint16_t saved_a = r->a;
        r->y = 0x4F37;
        DP16(r, 0x4C) = r->y;
        soe_call_rtl(0x8FCD78UL, r);
        r->a = saved_a;
        soe_nz16(r, r->a);
    }
    soe_carry(r, true);
}

SOE_BIND(freeze_boy_and_dog, 0x8CDB25, RTS)
{
    r->a = 0x0003;
    sub_8CDB31_bind(r);
}
