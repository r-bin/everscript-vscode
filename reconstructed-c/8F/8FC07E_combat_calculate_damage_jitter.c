/**
 * Routine: $8F:C07E (combat_calculate_damage_jitter)
 * Bank: $8F (ROM Offset: $0FC07E)
 * Calling convention: RTL
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   combat_calculate_damage_jitter ($8FC07E) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  16 instructions (28 bytes)
 * - Compiled C ASM:   209 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   13.1x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      b65f1a0dfc1482a9
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(combat_calculate_damage_jitter, 0x8FC07E, RTL);

void combat_calculate_damage_jitter_bind(soe_regs r) {
    uint16_t base = r->a;
    soe_cmp16(r, base, 0x0001u);
    if (r->p & SOE_N) {
        base = 0x0001u;
    }
    DP16(r, 0x12u) = base;
    DP16(r, 0x02u) = (uint16_t)(base + 1u);
    uint16_t saved_y = r->y;
    soe_call_rtl(0x80AD62u, r);
    r->y = saved_y;
    r->p &= (uint8_t)~SOE_C;
    uint16_t sum = soe_adc16(r, r->a, DP16(r, 0x12u));
    uint16_t doubled = (uint16_t)(sum << 1);
    soe_carry(r, (sum & 0x8000u) != 0u);
    uint16_t x3 = soe_adc16(r, doubled, DP16(r, 0x12u));
    uint16_t out = (uint16_t)(x3 >> 2);
    r->a = out;
    soe_carry(r, (x3 & 0x0002u) != 0u);
    soe_nz16(r, out);
}
