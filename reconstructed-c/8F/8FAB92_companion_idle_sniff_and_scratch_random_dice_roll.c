/*
 * $8F:AB92 companion_idle_sniff_and_scratch_random_dice_roll (knowledge/routines/companion_idle_sniff_and_scratch_random_dice_roll.md), RTL, 16-bit A, X, Y.
 *
 * Entity directional steering and wander update controller:
 * 1. Checks movement counter +$0E,y & $001F.
 * 2. Shifts RNG countdown register $0E94; on underflow rolls RNG ($80:859B) and re-seeds $0E94.
 * 3. If carry clear: branches to stationary / clear path ($8FABBE).
 * 4. If carry set: calls calc_8way_direction_with_random_jitter ($8F:AB6E).
 *    If state +$16,y & $0004 is clear, checks angular delta vs current heading +$22,y and updates +$22,y if >= 3.
 *    Otherwise updates +$22,y directly.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   companion_idle_sniff_and_scratch_random_dice_roll ($8FAB92) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  40 instructions (91 bytes)
 * - Compiled C ASM:   575 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   14.4x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      4c155e0515325c4b
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(companion_idle_sniff_and_scratch_random_dice_roll, 0x8FAB92, RTL)
{
    uint16_t a;
    uint16_t val;
    bool carry;

    SOE_AT(0xAB92);
    r->y = DP16(r, 0x4C);
    soe_nz16(r, r->y);

    SOE_AT(0xAB94);
    a = ABSI16(r, 0x000E, r->y);
    r->a = a;
    soe_nz16(r, a);
    soe_bit_imm(r, a, 0x001F);
    if (!(r->p & SOE_Z)) {
        goto check_state_branch;
    }

    SOE_AT(0xAB9C);
    val = RAM16(0x0E94);
    carry = (val & 0x0001) != 0;
    val >>= 1;
    RAM16(0x0E94) = val;
    soe_carry(r, carry);
    soe_nz16(r, val);

    if (val == 0) {
        SOE_AT(0xABA1);
        uint16_t saved_a = r->a;
        soe_call_rtl(0x80859BUL, r);
        soe_carry(r, true);
        a = soe_ror16(r, r->a);
        RAM16(0x0E94) = a;
        r->a = saved_a;
        soe_nz16(r, saved_a);
    }

    SOE_AT(0xABAC);
    if (!(r->p & SOE_C)) {
        goto check_state_branch;
    }

    SOE_AT(0xABAE);
    a = ABSI16(r, 0x0016, r->y);
    r->a = a;
    soe_nz16(r, a);
    soe_bit_imm(r, a, 0x0004);
    if (r->p & SOE_Z) {
        goto smooth_steer;
    }

    SOE_AT(0xABB6);
    soe_call_rtl(0x8FAB6EUL, r);
    ABSI16(r, 0x0022, r->y) = r->a;
    return;

check_state_branch:
    SOE_AT(0xABBE);
    a = ABSI16(r, 0x0016, r->y);
    r->a = a;
    soe_nz16(r, a);
    soe_bit_imm(r, a, 0x0004);
    if (r->p & SOE_Z) {
        goto clear_target;
    }

    SOE_AT(0xABC6);
    a = RAM16(0x0EB8);
    r->a = a;
    soe_nz16(r, a);
    soe_bit_imm(r, a, 0x0001);
    if (!(r->p & SOE_Z)) {
        goto clear_target;
    }
    return;

clear_target:
    SOE_AT(0xABCF);
    r->a = 0;
    soe_nz16(r, 0);
    ABSI16(r, 0x0064, r->y) = 0;
    return;

smooth_steer:
    SOE_AT(0xABD4);
    soe_call_rtl(0x8FAB6EUL, r);
    DP16(r, 0x12) = r->a;

    SOE_AT(0xABDA);
    soe_carry(r, true);
    a = soe_sbc16(r, r->a, ABSI16(r, 0x0022, r->y));
    a++;
    a &= 0x000E;
    r->a = a;
    soe_nz16(r, a);
    soe_cmp16(r, a, 0x0003);
    if (r->p & SOE_C) {
        SOE_AT(0xABE7);
        a = DP16(r, 0x12);
        ABSI16(r, 0x0022, r->y) = a;
        r->a = a;
        soe_nz16(r, a);
    }
}

