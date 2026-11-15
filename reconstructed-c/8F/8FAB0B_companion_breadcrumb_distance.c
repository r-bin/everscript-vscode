/*
 * Routines: sub_8FAB0B, sub_8FAB1E ($8F:AB0B, $8F:AB1E)
 * Companion breadcrumb history distance accumulator and threshold check.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sub_8FAB0B ($8FAB0B) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  56 instructions (99 bytes)
 * - Compiled C ASM:   69 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   1.2x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      c5f67e0d29f88601
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

static void companion_distance_walk(soe_regs r, uint8_t a_init) {
    uint8_t d12 = a_init;
    uint8_t d14 = a_init;
    DP8(r, 0x12u) = d12;
    DP8(r, 0x14u) = d14;

    uint16_t y = DP16(r, 0x4Eu);
    r->y = y;
    uint16_t x = (uint16_t)(ABSI16(r, 0x3BFFu, y) - 5u);
    uint16_t bound = DP16(r, 0x4Eu);

    while ((int16_t)(x - bound) >= 0) {
        uint8_t diff_y = (uint8_t)(ABSI8(r, 0x3BC9u, x) - ABSI8(r, 0x3BCCu, x));
        if ((diff_y & 0x80u) == 0u) {
            diff_y = (uint8_t)((uint8_t)(~diff_y) + 1u);
        }
        diff_y = (uint8_t)(diff_y << 1);
        DP8(r, 0x13u) = diff_y;

        x = (uint16_t)(x - 1u);
        uint8_t diff_x = (uint8_t)(ABSI8(r, 0x3BC9u, x) - ABSI8(r, 0x3BCCu, x));
        if ((diff_x & 0x80u) == 0u) {
            diff_x = (uint8_t)((uint8_t)(~diff_x) + 1u);
        }

        uint8_t cmp_res = (uint8_t)(diff_x - diff_y);
        uint8_t term = (cmp_res & 0x80u) ? diff_x : diff_y;

        r->p &= (uint8_t)~SOE_C;
        uint8_t sum = soe_adc8(r, d12, term);
        if ((r->p & SOE_N) != 0u) {
            // done_neg: 8FAB69 LDA $14; REP #$31; RTL
            r->x = x;
            r->a = (uint16_t)((r->a & 0xFF00u) | d14);
            r->p &= (uint8_t)~(SOE_M | SOE_X | SOE_C);
            if (d14 & 0x80u) r->p |= SOE_N; else r->p &= (uint8_t)~SOE_N;
            if (d14 == 0u) r->p |= SOE_Z; else r->p &= (uint8_t)~SOE_Z;
            return;
        }
        d12 = sum;
        DP8(r, 0x12u) = d12;
        x = (uint16_t)(x - 2u);
    }

    // done_bmi: 8FAB61 LDA $14; SEC; SBC $12; REP #$30; RTL
    r->x = x;
    r->p |= SOE_C;
    uint8_t diff = soe_sbc8(r, d14, d12);
    r->a = (uint16_t)((r->a & 0xFF00u) | diff);
    r->p &= (uint8_t)~(SOE_M | SOE_X);
}

SOE_BIND(sub_8FAB0B, 0x8FAB0B, RTL) {
    DP16(r, 0x12u) = r->a;
    uint16_t y = DP16(r, 0x4Eu);
    r->y = y;
    if ((ABSI16(r, 0x3C12u, y) & 0x0020u) == 0u) {
        r->a = 0u;
        r->p |= SOE_C;
        soe_nz16(r, 0u);
        return;
    }
    companion_distance_walk(r, (uint8_t)DP16(r, 0x12u));
}

SOE_BIND(sub_8FAB1E, 0x8FAB1E, RTL) {
    companion_distance_walk(r, SOE_A8(r));
}

