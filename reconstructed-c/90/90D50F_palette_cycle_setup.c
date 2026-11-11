/*
 * Routine: palette_cycle_setup ($90:D50F)
 * Configure a palette colour cycle slot for pair index ($02) and base CGRAM
 * colour (($02 << 3) + $04 + carry), with palette offset ($06) and rate ($08).
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   palette_cycle_setup ($90D50F) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  42 instructions (80 bytes)
 * - Compiled C ASM:   473 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   11.3x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      5740b5f4280a4521
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(palette_cycle_setup, 0x90D50F, RTL) {
    uint16_t saved_x = r->x;
    uint16_t a16 = DP16(r, 0x02u);
    uint16_t slot;
    uint8_t a8;
    uint16_t color_y;
    uint8_t color8;
    uint8_t rate;

    /* SEP #$21; TAX (16-bit X receives full A even with M=1) */
    r->p |= SOE_M | SOE_C;
    slot = a16;

    /* ASL A x3 in 8-bit mode: C receives old bit 5 before third shift */
    a8 = (uint8_t)(a16 & 0xFFu);
    soe_carry(r, (a8 & 0x20u) != 0u);
    a8 = (uint8_t)(a8 << 3);

    a8 = soe_adc8(r, a8, DP8(r, 0x04u));
    color_y = (uint16_t)((a16 & 0xFF00u) | a8);
    color8 = (uint8_t)(color_y & 0xFFu);

    if (ABSI8(r, PALETTE_ANIM_RATE_ADDR, slot) != 0u) {
        soe_cmp8(r, color8, ABSI8(r, PALETTE_ANIM_COLOR_INDEX_ADDR, slot));
        if ((r->p & SOE_Z) == 0u) {
            slot = (uint16_t)(slot + 1u);
            soe_cmp8(r, color8, ABSI8(r, PALETTE_ANIM_COLOR_INDEX_ADDR, slot));
            if ((r->p & SOE_Z) == 0u) {
                if (ABSI8(r, PALETTE_ANIM_RATE_ADDR, slot) != 0u) {
                    slot = (uint16_t)(slot - 2u);
                }
            }
        }
    }

    ABSI8(r, PALETTE_ANIM_COLOR_INDEX_ADDR, slot) = color8;

    rate = DP8(r, 0x08u);
    ABSI8(r, PALETTE_ANIM_RATE_ADDR, slot) = rate;
    if ((rate & 0x80u) == 0u) {
        ABSI8(r, PALETTE_ANIM_FRAME_TIMER_ADDR, slot) = rate;
        a8 = DP8(r, 0x06u);
        ABSI8(r, PALETTE_ANIM_INTERP_B_ADDR, slot) = a8;
        ABSI8(r, PALETTE_ANIM_INTERP_A_ADDR, slot) = 0x00u;
    } else {
        uint8_t abs_rate = (uint8_t)~(uint8_t)(rate - 1u);
        ABSI8(r, PALETTE_ANIM_FRAME_TIMER_ADDR, slot) = abs_rate;
        a8 = DP8(r, 0x06u);
        ABSI8(r, PALETTE_ANIM_INTERP_A_ADDR, slot) = a8;
        ABSI8(r, PALETTE_ANIM_INTERP_B_ADDR, slot) = 0x00u;
    }

    /* REP #$30; PLY; PLX */
    r->a = (uint16_t)((a16 & 0xFF00u) | a8);
    soe_nz16(r, saved_x);
    r->p &= (uint8_t)~(SOE_M | SOE_X);
}

