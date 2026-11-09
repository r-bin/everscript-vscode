/*
 * $8F:C40F entity_sleep_wake (knowledge/routines/entity_sleep_wake.md), RTS, 16-bit A and X.
 *
 * Entity sleep and wake controller:
 * 30 entity slots at $3DE5 (stride $8E), Boy $4E89, Dog $4F37; awake list $3DDF, asleep list $3DE1.
 * 
 * Awake ($0100):
 * - If +$10 & $0030, HP 0, or awake count $1070 < budget $1076, stays awake.
 * - If +$6C >= 0, blocks sleep.
 * - Outside [-48, 304) on screen X or Y:
 *   If spawner-made (+0x8C != 0), calls $8F:DF41.
 *   Otherwise calls $8F:C514 (entity_go_to_sleep).
 * 
 * Asleep ($0200):
 * - If HP 0: freed via $8F:B31E (unless +$3E links it).
 * - If +$10 & $0008: stays asleep.
 * - If & $0070, +$6C >= 0, $1070 + 2 < $1076, or spawner-made (+0x8C != 0): wakes at once.
 * - Outside [-16, 272) on screen X or Y: stays asleep.
 * - Otherwise wakes: increments $1070, decrements $1072, flips +$10 $0200 -> $0100, moves from $3DE1 to $3DDF via $8F:B29B,
 *   clears state/speed fields, and restarts stand animation via $90:817B.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   entity_sleep_wake ($8FC40F) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  132 instructions (325 bytes)
 * - Compiled C ASM:   1362 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   10.3x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      30088a299f260934
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(entity_sleep_wake, 0x8FC40F, RTS)
{
    uint16_t a;

    SOE_AT(0xC40F);
    r->y = DP16(r, 0x4C);
    soe_nz16(r, r->y);

    SOE_AT(0xC411);
    a = ABSI16(r, 0x0010, r->y);
    r->a = a;
    soe_nz16(r, a);

    SOE_AT(0xC414);
    soe_bit_imm(r, a, 0x0100);
    if (r->p & SOE_Z) {
        goto asleep_path;
    }

    SOE_AT(0xC419);
    soe_bit_imm(r, a, 0x0030);
    if (!(r->p & SOE_Z)) {
        return;
    }

    SOE_AT(0xC41E);
    a = ABSI16(r, 0x002A, r->y);
    r->a = a;
    soe_nz16(r, a);
    if (a == 0) {
        return;
    }

    SOE_AT(0xC423);
    a = RAM16(0x1070);
    r->a = a;
    soe_nz16(r, a);
    soe_cmp16(r, a, RAM16(0x1076));
    if (!(r->p & SOE_C)) {
        return;
    }

    SOE_AT(0xC42B);
    a = ABSI16(r, 0x006C, r->y);
    r->a = a;
    soe_nz16(r, a);
    if (!(r->p & SOE_N)) {
        return;
    }

    SOE_AT(0xC430);
    soe_carry(r, true);
    a = soe_sbc16(r, ABSI16(r, 0x001A, r->y), DP16(r, 0x59));
    r->a = a;
    soe_nz16(r, a);
    soe_cmp16(r, a, 0xFFD0);
    if (r->p & SOE_N) {
        goto put_to_sleep;
    }
    soe_cmp16(r, a, 0x0130);
    if (!(r->p & SOE_N)) {
        goto put_to_sleep;
    }

    SOE_AT(0xC440);
    soe_carry(r, true);
    a = soe_sbc16(r, ABSI16(r, 0x001C, r->y), DP16(r, 0x5B));
    r->a = a;
    soe_nz16(r, a);
    soe_cmp16(r, a, 0xFFD0);
    if (r->p & SOE_N) {
        goto put_to_sleep;
    }
    soe_cmp16(r, a, 0x0130);
    if (!(r->p & SOE_N)) {
        goto put_to_sleep;
    }
    return;

put_to_sleep:
    SOE_AT(0xC451);
    r->x = ABSI16(r, 0x008C, r->y);
    soe_nz16(r, r->x);
    if (r->x == 0) {
        SOE_AT(0xC456);
        soe_call_rts(0x8FC514UL, r);
        return;
    }
    SOE_AT(0xC459);
    soe_call_rtl(0x8FDF41UL, r);
    return;

asleep_path:
    SOE_AT(0xC45E);
    a = ABSI16(r, 0x002A, r->y);
    r->a = a;
    soe_nz16(r, a);
    if (a == 0) {
        SOE_AT(0xC463);
        a = ABSI16(r, 0x003E, r->y);
        r->a = a;
        soe_nz16(r, a);
        if (a != 0) {
            return;
        }
        SOE_AT(0xC468);
        soe_call_rtl(0x8FB31EUL, r);
        return;
    }

    SOE_AT(0xC46D);
    a = ABSI16(r, 0x0010, r->y);
    r->a = a;
    soe_nz16(r, a);
    soe_bit_imm(r, a, 0x0008);
    if (!(r->p & SOE_Z)) {
        return;
    }
    soe_bit_imm(r, a, 0x0070);
    if (!(r->p & SOE_Z)) {
        goto wake_up;
    }

    SOE_AT(0xC47A);
    a = ABSI16(r, 0x006C, r->y);
    r->a = a;
    soe_nz16(r, a);
    if (!(r->p & SOE_N)) {
        goto wake_up;
    }

    SOE_AT(0xC47F);
    a = (uint16_t)(RAM16(0x1070) + 1);
    a = (uint16_t)(a + 1);
    r->a = a;
    soe_nz16(r, a);
    soe_cmp16(r, a, RAM16(0x1076));
    if (!(r->p & SOE_C)) {
        goto wake_up;
    }

    SOE_AT(0xC489);
    a = ABSI16(r, 0x008C, r->y);
    r->a = a;
    soe_nz16(r, a);
    if (a != 0) {
        goto wake_up;
    }

    SOE_AT(0xC48E);
    soe_carry(r, true);
    a = soe_sbc16(r, ABSI16(r, 0x001A, r->y), DP16(r, 0x59));
    r->a = a;
    soe_nz16(r, a);
    soe_cmp16(r, a, 0xFFF0);
    if (r->p & SOE_N) {
        return;
    }
    soe_cmp16(r, a, 0x0110);
    if (!(r->p & SOE_N)) {
        return;
    }

    SOE_AT(0xC49E);
    soe_carry(r, true);
    a = soe_sbc16(r, ABSI16(r, 0x001C, r->y), DP16(r, 0x5B));
    r->a = a;
    soe_nz16(r, a);
    soe_cmp16(r, a, 0xFFF0);
    if (r->p & SOE_N) {
        return;
    }
    soe_cmp16(r, a, 0x0110);
    if (!(r->p & SOE_N)) {
        return;
    }

wake_up:
    SOE_AT(0xC4B1);
    RAM16(0x1070) = (uint16_t)(RAM16(0x1070) + 1);
    RAM16(0x1072) = (uint16_t)(RAM16(0x1072) - 1);

    SOE_AT(0xC4B7);
    r->x = ABSI16(r, 0x0060, r->y);
    soe_nz16(r, r->x);
    a = ROM16(0x8E0007UL + r->x);
    r->a = a;
    soe_nz16(r, a);
    soe_bit_imm(r, a, 0x0001);
    if (r->p & SOE_Z) {
        goto wake_flip_state;
    }

    SOE_AT(0xC4C3);
    r->x = 0x58AF;
    while (true) {
        SOE_AT(0xC4C6);
        a = RAM16(r->x);
        r->a = a;
        soe_nz16(r, a);
        if (a == 0) {
            SOE_AT(0xC4D8);
            soe_call_rts(0x8FC554UL, r);
            RAM16(r->x) = r->y;
            ABSI16(r, 0x0086, r->y) = r->x;
            break;
        }
        SOE_AT(0xC4CB);
        soe_carry(r, false);
        a = soe_adc16(r, r->x, 0x0082);
        r->x = a;
        soe_cmp16(r, a, 0x5DC3);
        if (r->p & SOE_Z) {
            soe_carry(r, false);
            return;
        }
    }

wake_flip_state:
    SOE_AT(0xC4E3);
    a = (uint16_t)(ABSI16(r, 0x0010, r->y) ^ 0x0300);
    ABSI16(r, 0x0010, r->y) = a;
    r->a = a;
    soe_nz16(r, a);

    SOE_AT(0xC4EC);
    r->x = 0x3D83;
    r->y = 0x3D81;
    soe_call_rts(0x8FB29BUL, r);

    SOE_AT(0xC4F5);
    r->y = DP16(r, 0x4C);
    soe_nz16(r, r->y);

    SOE_AT(0xC4F7);
    r->a = 0;
    soe_nz16(r, 0);
    ABSI16(r, 0x0016, r->y) = 0;
    ABSI16(r, 0x0078, r->y) = 0;
    ABSI16(r, 0x0006, r->y) = 0;
    ABSI16(r, 0x0008, r->y) = 0;
    ABSI16(r, 0x000A, r->y) = 0;

    SOE_AT(0xC507);
    r->x = ABSI16(r, 0x0060, r->y);
    a = ROM16(0x8E0032UL + r->x);
    r->a = a;
    r->x = a;
    soe_nz16(r, a);

    SOE_AT(0xC50F);
    soe_call_rtl(0x90817BUL, r);
}
