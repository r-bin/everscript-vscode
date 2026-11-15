/*
 * $90:87BA — melee_weapon_strike_hitbox_offset_and_collision_test (RTS)
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sub_9087DF ($9087DF) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  24 instructions (49 bytes)
 * - Compiled C ASM:   349 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   14.5x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      4e6be0ef78154ea4
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(melee_weapon_strike_hitbox_offset_and_collision_test, 0x9087BA, RTS);
SOE_BIND(sub_9087DF, 0x9087DF, RTS);
void sub_9087DF_bind(soe_regs r) {
    r->p &= (uint8_t)~SOE_C;
    DP16(r, 0x46) = soe_adc16(r, r->a, RAM16((uint16_t)(r->y + 0x001Au)));
    DP16(r, 0x44) = RAM16((uint16_t)(r->y + 0x0018u));
    DP16(r, 0x4A) = RAM16((uint16_t)(r->y + 0x001Eu));

    uint16_t idx = (uint16_t)(DP16(r, 0x5D) + 2u);
    DP16(r, 0x5D) = 0;
    uint32_t base = (uint32_t)DP8(r, 0x5F) << 16;
    DP16(r, 0x3E) = (uint16_t)(LONG16(base + idx) & 0x00FFu);
    idx = (uint16_t)(idx + 1u);
    DP16(r, 0x40) = (uint16_t)(LONG16(base + idx) & 0x00FFu);
    idx = (uint16_t)(idx + 1u);
    DP16(r, 0x5D) = idx;
    r->y = idx;
    r->a = DP16(r, 0x40);

    soe_call_rtl(0x8FB5E6u, r);

    r->p |= SOE_M;
    r->y = DP16(r, 0x4C);
    soe_nz16(r, r->y);
}

void melee_weapon_strike_hitbox_offset_and_collision_test_bind(soe_regs r)
{
    r->p &= (uint8_t)~(SOE_M | SOE_C);
    uint16_t raw = LONG16(((uint32_t)DP8(r, 0x5F) << 16) | DP16(r, 0x5D));
    DP16(r, 0x46) = raw;

    uint16_t dy = (uint16_t)((raw >> 8) | ((raw & 0x8000u) ? 0xFF00u : 0x0000u));
    DP16(r, 0x48) = soe_adc16(r, dy, RAM16((uint16_t)(r->y + 0x001Cu)));

    uint16_t dx = (uint16_t)((raw & 0x00FFu) | ((raw & 0x0080u) ? 0xFF00u : 0x0000u));
    r->a = dx;
    sub_9087DF_bind(r);
}