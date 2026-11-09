/*
 * $8F:D82F ai_companion_evaluate_target_candidate (knowledge/routines/ai_companion_evaluate_target_candidate.md), RTS, 16-bit A and X.
 *
 * Validates candidate entity X for companion targeting and tests distance to entity Y against DP $12.
 * Stores signed dx in DP $02 and signed dy in DP $04.
 * Returns C clear if valid and within distance; C set if rejected or outside radius.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   ai_companion_evaluate_target_candidate ($8FD82F) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  34 instructions (74 bytes)
 * - Compiled C ASM:   488 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   14.4x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      bc238b59d2362b00
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(ai_companion_evaluate_target_candidate, 0x8FD82F, RTS)
{
    uint16_t a;

    SOE_AT(0xD82F);
    a = ABSI16(r, 0x002A, r->x);
    if (a == 0) {
        SOE_AT(0xD877);
        soe_carry(r, true);
        r->a = a;
        soe_nz16(r, a);
        return;
    }

    SOE_AT(0xD834);
    a = (uint16_t)(ABSI16(r, 0x0010, r->x) ^ 0x0100);
    soe_bit_imm(r, a, 0x4106);
    if (!(r->p & SOE_Z)) {
        SOE_AT(0xD877);
        soe_carry(r, true);
        r->a = a;
        soe_nz16(r, a);
        return;
    }

    SOE_AT(0xD83F);
    a = ABSI16(r, 0x0014, r->x);
    soe_bit_imm(r, a, 0x0040);
    if (!(r->p & SOE_Z)) {
        SOE_AT(0xD877);
        soe_carry(r, true);
        r->a = a;
        soe_nz16(r, a);
        return;
    }

    SOE_AT(0xD847);
    a = ABSI16(r, 0x001A, r->x);
    soe_carry(r, false);
    a = soe_adc16(r, a, ABSI16(r, 0x0042, r->x));
    soe_carry(r, true);
    a = soe_sbc16(r, a, ABSI16(r, 0x001A, r->y));
    DP16(r, 0x02) = a;
    if (a & 0x8000) {
        SOE_AT(0xD856);
        a = (uint16_t)((a - 1) ^ 0xFFFF);
        soe_nz16(r, a);
    }
    SOE_AT(0xD85A);
    soe_cmp16(r, a, DP16(r, 0x12));
    if (r->p & SOE_C) {
        SOE_AT(0xD878);
        r->a = a;
        return;
    }

    SOE_AT(0xD85E);
    a = ABSI16(r, 0x001C, r->x);
    soe_carry(r, false);
    a = soe_adc16(r, a, 0x0010);
    a = soe_adc16(r, a, ABSI16(r, 0x0044, r->x));
    soe_carry(r, true);
    a = soe_sbc16(r, a, ABSI16(r, 0x001C, r->y));
    DP16(r, 0x04) = a;
    if (a & 0x8000) {
        SOE_AT(0xD870);
        a = (uint16_t)((a - 1) ^ 0xFFFF);
        soe_nz16(r, a);
    }
    SOE_AT(0xD874);
    soe_cmp16(r, a, DP16(r, 0x12));
    r->a = a;
}

