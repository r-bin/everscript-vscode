/*
 * $8F:D787 ai_companion_pick_target (knowledge/routines/ai_companion_pick_target.md), RTS, 16-bit A and X.
 *
 * Selects an enemy target for the companion entity Y based on AI aggression setting in A (0..5).
 * Priority:
 * 1. Forced target in $7E:144F
 * 2. Last attacker in +$80,Y
 * 3. Current target in +$24,Y (if still valid and in range)
 * 4. Nearest valid enemy in active list $7E:3DDF within radius of leader $7E:0F42
 * Returns chosen target in A and X, stored to +$24,Y; Y restored from DP $4C.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   ai_companion_pick_target ($8FD787) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  71 instructions (154 bytes)
 * - Compiled C ASM:   845 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   11.9x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      4dc0206a47729c67
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(ai_companion_pick_target, 0x8FD787, RTS)
{
    uint16_t a;
    uint16_t x;

    SOE_AT(0xD787);
    a = (uint16_t)(r->a << 1);
    if (a == 0) {
        SOE_AT(0xD78A);
        ABSI16(r, 0x0024, r->y) = a;
        r->x = a;
        r->a = a;
        soe_nz16(r, a);
        return;
    }

    SOE_AT(0xD78F);
    x = a;
    r->x = x;
    a = ROM16(0x8FD821UL + x);
    DP16(r, 0x12) = a;
    r->a = a;
    soe_nz16(r, a);

    SOE_AT(0xD796);
    x = RAM16(0x144F);
    r->x = x;
    if (x != 0) {
        a = ABSI16(r, 0x002A, x);
        if (a == 0) {
            SOE_AT(0xD7CF);
            RAM16(0x144F) = 0;
            goto check_attacker;
        }
        a = ABSI16(r, 0x0010, x);
        soe_bit_imm(r, a, 0x0300);
        if (r->p & SOE_Z) {
            SOE_AT(0xD7CF);
            RAM16(0x144F) = 0;
            goto check_attacker;
        }
        soe_bit_imm(r, a, 0x0100);
        if (r->p & SOE_Z) {
            goto check_attacker;
        }

        SOE_AT(0xD7AD);
        a = ABSI16(r, 0x001A, x);
        soe_carry(r, false);
        a = soe_adc16(r, a, ABSI16(r, 0x0042, x));
        soe_carry(r, true);
        a = soe_sbc16(r, a, ABSI16(r, 0x001A, r->y));
        DP16(r, 0x02) = a;

        a = ABSI16(r, 0x001C, x);
        soe_carry(r, false);
        a = soe_adc16(r, a, 0x0010);
        a = soe_adc16(r, a, ABSI16(r, 0x0044, x));
        soe_carry(r, true);
        a = soe_sbc16(r, a, ABSI16(r, 0x001C, r->y));
        DP16(r, 0x04) = a;

        a = x;
        ABSI16(r, 0x0024, r->y) = a;
        r->a = a;
        soe_nz16(r, a);
        return;
    }

check_attacker:
    SOE_AT(0xD7D2);
    x = ABSI16(r, 0x0080, r->y);
    r->x = x;
    if (x != 0) {
        soe_call_rts(0x8FD82FUL, r);
        if (!(r->p & SOE_C)) {
            SOE_AT(0xD7DC);
            a = r->x;
            ABSI16(r, 0x0024, r->y) = a;
            r->a = a;
            soe_nz16(r, a);
            return;
        }
    }

    SOE_AT(0xD7E1);
    x = ABSI16(r, 0x0024, r->y);
    r->x = x;
    if (x != 0) {
        soe_call_rts(0x8FD82FUL, r);
        if (!(r->p & SOE_C)) {
            SOE_AT(0xD7EB);
            a = r->x;
            r->a = a;
            soe_nz16(r, a);
            return;
        }
    }

    SOE_AT(0xD7ED);
    DP16(r, 0x14) = 0;
    r->y = RAM16(0x0F42);
    x = RAM16(0x3DDF);
    r->x = x;
    while (true) {
        soe_call_rts(0x8FD82FUL, r);
        if (!(r->p & SOE_C)) {
            SOE_AT(0xD7FA);
            DP16(r, 0x12) = r->a;
            DP16(r, 0x14) = r->x;
        }
        SOE_AT(0xD7FE);
        x = ABSI16(r, 0x005E, r->x);
        r->x = x;
        if (x == 0) break;
    }

    SOE_AT(0xD804);
    r->y = DP16(r, 0x4C);
    x = DP16(r, 0x14);
    r->x = x;
    if (x != 0) {
        SOE_AT(0xD80A);
        a = ABSI16(r, 0x001A, x);
        soe_carry(r, true);
        a = soe_sbc16(r, a, ABSI16(r, 0x001A, r->y));
        DP16(r, 0x02) = a;

        a = ABSI16(r, 0x001C, x);
        soe_carry(r, true);
        a = soe_sbc16(r, a, ABSI16(r, 0x001C, r->y));
        DP16(r, 0x04) = a;
    }

    SOE_AT(0xD81C);
    a = x;
    ABSI16(r, 0x0024, r->y) = a;
    r->a = a;
    soe_nz16(r, a);
}

