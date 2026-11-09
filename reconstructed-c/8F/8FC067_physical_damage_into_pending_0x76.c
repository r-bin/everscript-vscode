/*
 * $8F:C067 physical_damage_into_pending_0x76 (knowledge/routines/physical_damage_into_pending_0x76.md), RTL, 16-bit A and X.
 *
 * Core physical weapon damage calculation:
 * 1. Computes attacker base attack power via $8F:C02B (attacker in DP $4C), stored to DP $12.
 * 2. Fetches target defense from $8E:001B,X (target entity Y, stats record in +$60,Y).
 * 3. Base damage = max(1, attack - target_defense / 4).
 * 4. Rolls random offset 0..base_damage via $80:AD62 with range (base_damage + 1) in DP $02.
 * 5. Net damage = ((random_offset + base_damage) * 3) / 4.
 * Returns calculated damage in register A.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   physical_damage_into_pending_0x76 ($8FC067) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  26 instructions (51 bytes)
 * - Compiled C ASM:   370 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   14.2x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      70f69ddac697f80d
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(physical_damage_into_pending_0x76, 0x8FC067, RTL)
{
    uint16_t a;
    uint16_t y;

    SOE_AT(0xC067);
    r->x = DP16(r, 0x4C);
    soe_nz16(r, r->x);

    SOE_AT(0xC069);
    soe_call_rtl(0x8FC02BUL, r);

    SOE_AT(0xC06D);
    DP16(r, 0x12) = r->a;

    SOE_AT(0xC06F);
    r->x = ABSI16(r, 0x0060, r->y);
    soe_nz16(r, r->x);

    SOE_AT(0xC072);
    a = ROM16(0x8E001BUL + r->x);
    r->a = a;
    soe_nz16(r, a);

    SOE_AT(0xC076);
    a = (uint16_t)(a >> 1);
    a = (uint16_t)(a >> 1);
    r->a = a;
    soe_nz16(r, a);

    SOE_AT(0xC078);
    soe_carry(r, false);
    a = soe_sbc16(r, a, DP16(r, 0x12));

    SOE_AT(0xC07B);
    a ^= 0xFFFF;
    r->a = a;
    soe_nz16(r, a);

    SOE_AT(0xC07E);
    soe_cmp16(r, a, 0x0001);
    if (r->p & SOE_N) {
        SOE_AT(0xC083);
        a = 0x0001;
    }

    SOE_AT(0xC086);
    DP16(r, 0x12) = a;
    r->a = a;
    soe_nz16(r, a);

    SOE_AT(0xC088);
    a = (uint16_t)(a + 1);
    r->a = a;
    soe_nz16(r, a);

    SOE_AT(0xC089);
    DP16(r, 0x02) = a;

    SOE_AT(0xC08B);
    y = r->y;

    SOE_AT(0xC08C);
    soe_call_rtl(0x80AD62UL, r);

    SOE_AT(0xC090);
    r->y = y;

    SOE_AT(0xC091);
    soe_carry(r, false);
    a = soe_adc16(r, r->a, DP16(r, 0x12));

    SOE_AT(0xC094);
    soe_carry(r, (a & 0x8000) != 0);
    a = (uint16_t)(a << 1);
    soe_nz16(r, a);

    SOE_AT(0xC095);
    a = soe_adc16(r, a, DP16(r, 0x12));

    SOE_AT(0xC097);
    a = (uint16_t)(a >> 1);
    SOE_AT(0xC098);
    soe_carry(r, (a & 0x0001) != 0);
    a = (uint16_t)(a >> 1);
    r->a = a;
    soe_nz16(r, a);
}

