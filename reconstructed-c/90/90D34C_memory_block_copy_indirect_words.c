/*
 * $90:D34C memory_block_copy_indirect_words (knowledge/routines/memory_block_copy_indirect_words.md), RTL, 16-bit A, X, Y.
 *
 * Palette color crossfader / block transfer:
 * - DP $14: word count (number of 16-bit BGR555 colors to process). If 0, returns immediately.
 * - DP $12: blend ratio (0..0x100).
 * - DP $26: far pointer to source palette A.
 * - DP $2A: far pointer to source palette B.
 * - DP $2E: far pointer to destination palette.
 *
 * If ratio == 0: copies words from [$26] to [$2E].
 * If ratio >= 0x100 (signed CMP #$0100, BPL): copies words from [$2A] to [$2E].
 * If 0 < ratio < 0x100 (BMI): blends each 15-bit BGR555 color:
 *   Red:   ((256 - ratio) * Red_A   + ratio * Red_B)   >> 8
 *   Green: ((256 - ratio) * Green_A + ratio * Green_B) >> 8
 *   Blue:  ((256 - ratio) * Blue_A  + ratio * Blue_B)  >> 8
 * Uses hardware multiplier ($4202/$4203 -> $4216).
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   memory_block_copy_indirect_words ($90D34C) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  104 instructions (188 bytes)
 * - Compiled C ASM:   1000 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   9.6x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      0b99f18e5eeace12
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(memory_block_copy_indirect_words, 0x90D34C, RTL)
{
    SOE_AT(0xD34C);
    uint16_t count = DP16(r, 0x14);
    if (count == 0) {
        r->a = 0;
        soe_nz16(r, 0);
        return;
    }

    SOE_AT(0xD351);
    uint16_t c_minus_1 = (uint16_t)(count - 1);
    uint16_t y = (uint16_t)(c_minus_1 << 1);
    uint16_t ratio = DP16(r, 0x12);

    if (ratio == 0) {
        SOE_AT(0xD358);
        soe_carry(r, (c_minus_1 & 0x8000) != 0);
        uint16_t last_col = 0;
        do {
            last_col = LONG16(SOE_DPPTR(r, 0x26) + y);
            LONG16(SOE_DPPTR(r, 0x2E) + y) = last_col;
            y = (uint16_t)(y - 2);
        } while ((y & 0x8000) == 0);
        r->a = last_col;
        r->y = y;
        soe_nz16(r, y);
        return;
    }

    SOE_AT(0xD361);
    int16_t ratio_diff = (int16_t)(ratio - 0x0100);
    if (ratio_diff >= 0) {
        SOE_AT(0xD366);
        r->p |= SOE_C;
        uint16_t last_col = 0;
        do {
            last_col = LONG16(SOE_DPPTR(r, 0x2A) + y);
            LONG16(SOE_DPPTR(r, 0x2E) + y) = last_col;
            y = (uint16_t)(y - 2);
        } while ((y & 0x8000) == 0);
        r->a = last_col;
        r->y = y;
        soe_nz16(r, y);
        return;
    }

    // 0 < ratio < 0x100
    uint8_t last_carry = 0;
    uint16_t final_col = 0;
    do {
        SOE_AT(0xD36F);
        // 1. Red: col_a swapped & 0x1F00, ORA $12, EOR #$00FF, INC A -> $4202
        uint16_t col_a_red = LONG16(SOE_DPPTR(r, 0x26) + y);
        uint16_t red_a_term = (uint16_t)((((col_a_red & 0x001F) << 8) | ratio) ^ 0x00FF) + 1;
        ABS16(r, 0x4202) = red_a_term;
        r->x = ABS16(r, 0x4216);

        uint16_t col_b_red = LONG16(SOE_DPPTR(r, 0x2A) + y);
        uint16_t red_b_term = (uint16_t)(((col_b_red & 0x001F) << 8) | ratio);
        ABS16(r, 0x4202) = red_b_term;
        uint16_t red_sum = (uint16_t)(r->x + ABS16(r, 0x4216));
        uint16_t blended_red = (uint16_t)((red_sum >> 8) & 0x001F);
        LONG16(SOE_DPPTR(r, 0x2E) + y) = blended_red;

        // 2. Green: (col_a << 3) & 0x1F00, ORA $12, EOR #$00FF, INC A -> $4202
        uint16_t col_a_green = LONG16(SOE_DPPTR(r, 0x26) + y);
        uint16_t green_a_term = (uint16_t)((((col_a_green << 3) & 0x1F00) | ratio) ^ 0x00FF) + 1;
        ABS16(r, 0x4202) = green_a_term;
        r->x = ABS16(r, 0x4216);

        uint16_t col_b_green = LONG16(SOE_DPPTR(r, 0x2A) + y);
        uint16_t green_b_term = (uint16_t)(((col_b_green << 3) & 0x1F00) | ratio);
        ABS16(r, 0x4202) = green_b_term;
        uint16_t green_sum = (uint16_t)(r->x + ABS16(r, 0x4216));
        uint16_t blended_green = (uint16_t)((green_sum >> 3) & 0x03E0);
        LONG16(SOE_DPPTR(r, 0x2E) + y) = (uint16_t)(LONG16(SOE_DPPTR(r, 0x2E) + y) | blended_green);

        // 3. Blue: (col_a >> 2) & 0x1F00, ORA $12, EOR #$00FF, INC A -> $4202
        uint16_t col_a_blue = LONG16(SOE_DPPTR(r, 0x26) + y);
        uint16_t blue_a_term = (uint16_t)((((col_a_blue >> 2) & 0x1F00) | ratio) ^ 0x00FF) + 1;
        ABS16(r, 0x4202) = blue_a_term;
        r->x = ABS16(r, 0x4216);

        uint16_t col_b_blue = LONG16(SOE_DPPTR(r, 0x2A) + y);
        uint16_t blue_b_term = (uint16_t)(((col_b_blue >> 2) & 0x1F00) | ratio);
        ABS16(r, 0x4202) = blue_b_term;
        r->p &= ~SOE_C;
        uint16_t blue_sum = soe_adc16(r, r->x, ABS16(r, 0x4216));
        last_carry = (uint8_t)((blue_sum & 0x4000) != 0);
        uint16_t blended_blue = (uint16_t)((blue_sum << 2) & 0x7C00);
        final_col = (uint16_t)(LONG16(SOE_DPPTR(r, 0x2E) + y) | blended_blue);
        LONG16(SOE_DPPTR(r, 0x2E) + y) = final_col;

        y = (uint16_t)(y - 2);
    } while ((y & 0x8000) == 0);

    r->a = final_col;
    r->y = y;
    soe_carry(r, last_carry);
    soe_nz16(r, y);
}
