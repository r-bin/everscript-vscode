/*
 * $80:AEAC math_vector_2d_angle_and_distance_calc (knowledge/routines/math_vector_2d_angle_and_distance_calc.md), RTL, 16-bit A, X, Y.
 *
 * Computes 8-bit directional angle (0..255) from signed delta-X (DP $02) and delta-Y (DP $04):
 * 1. Takes absolute values: |DX| -> DP $12, |DY| -> DP $14.
 * 2. Compares |DX| and |DY| to select one of 8 octants.
 * 3. Uses hardware divider ($4204 / $4206) to compute 64 * min(|DX|, |DY|) / max(|DX|, |DY|).
 * 4. Indexes 64-entry arctan table at ROM $80:8B25.
 * 5. Folds/offsets table angle into the appropriate octant:
 *      Octant 0 (DX >= 0, DY >= 0, DY <  DX): angle
 *      Octant 1 (DX >= 0, DY >= 0, DY >= DX): 0x40 - angle (via ADC #$0041 on ~ang)
 *      Octant 2 (DX <  0, DY >= 0, DY >= DX): 0x40 + angle (via ADC #$0040 on ang)
 *      Octant 3 (DX <  0, DY >= 0, DY <  DX): 0x80 - angle (via ADC #$0081 on ~ang)
 *      Octant 4 (DX <  0, DY <  0, DY <  DX): 0xFF80 + angle (via ADC #$FF80 on ang)
 *      Octant 5 (DX <  0, DY <  0, DY >= DX): 0xFFC0 - angle (via ADC #$FFC1 on ~ang)
 *      Octant 6 (DX >= 0, DY <  0, DY >= DX): 0xFFC0 + angle (via ADC #$FFC0 on ang)
 *      Octant 7 (DX >= 0, DY <  0, DY <  DX): -angle
 * 6. Restores entry DB via PLB.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   math_vector_2d_angle_and_distance_calc ($80AEAC) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  181 instructions (369 bytes)
 * - Compiled C ASM:   322 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   1.8x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      3c859eaf2b669363
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

#define ARCTAN_OCTANT_TABLE_ADDR 0xC08B25UL

static inline uint16_t divide_octant(soe_regs r, uint16_t num, uint16_t den) {
    uint16_t xba = (uint16_t)((num >> 8) | (num << 8));
    soe_carry(r, (xba & 0x0002) != 0);
    uint16_t dividend = (uint16_t)((xba >> 2) & 0x3FC0);
    ABS16(r, 0x4204) = dividend;
    ABS8(r, 0x4206) = (uint8_t)den;
    r->x = ABS16(r, 0x4214);
    return ROM8(ARCTAN_OCTANT_TABLE_ADDR + r->x);
}

SOE_BIND(math_vector_2d_angle_and_distance_calc, 0x80AEAC, RTL)
{
    uint8_t entry_db = r->db;
    r->db = 0x80;

    int16_t dx = (int16_t)DP16(r, 0x02);
    int16_t dy = (int16_t)DP16(r, 0x04);

    SOE_AT(0xAEAC);
    if (dx >= 0) {
        SOE_AT(0xAEB6);
        DP16(r, 0x12) = (uint16_t)dx;
        if (dy >= 0) {
            DP16(r, 0x14) = (uint16_t)dy;
            if ((uint16_t)dy < (uint16_t)dx) {
                // Octant 0: angle
                r->a = divide_octant(r, (uint16_t)dy, (uint16_t)dx);
            } else {
                SOE_AT(0xAEE4);
                // Octant 1: 0x40 - angle
                uint16_t ang = divide_octant(r, (uint16_t)dx, (uint16_t)dy);
                r->p &= ~SOE_C;
                r->a = soe_adc16(r, (uint16_t)~ang, 0x0041);
            }
        } else {
            SOE_AT(0xAF0E);
            uint16_t abs_y = (uint16_t)(-dy);
            DP16(r, 0x14) = abs_y;
            if (abs_y < (uint16_t)dx) {
                // Octant 7: -angle
                uint16_t ang = divide_octant(r, abs_y, (uint16_t)dx);
                r->a = (uint16_t)((uint16_t)~ang + 1);
            } else {
                SOE_AT(0xAF3E);
                // Octant 6: 0xFFC0 + angle
                uint16_t ang = divide_octant(r, (uint16_t)dx, abs_y);
                r->p &= ~SOE_C;
                r->a = soe_adc16(r, ang, 0xFFC0);
            }
        }
    } else {
        SOE_AT(0xAF65);
        uint16_t abs_x = (uint16_t)(-dx);
        DP16(r, 0x12) = abs_x;
        if (dy >= 0) {
            DP16(r, 0x14) = (uint16_t)dy;
            if ((uint16_t)dy < abs_x) {
                // Octant 3: 0x80 - angle
                uint16_t ang = divide_octant(r, (uint16_t)dy, abs_x);
                r->p &= ~SOE_C;
                r->a = soe_adc16(r, (uint16_t)~ang, 0x0081);
            } else {
                SOE_AT(0xAF9D);
                // Octant 2: 0x40 + angle
                uint16_t ang = divide_octant(r, abs_x, (uint16_t)dy);
                r->p &= ~SOE_C;
                r->a = soe_adc16(r, ang, 0x0040);
            }
        } else {
            SOE_AT(0xAFC4);
            uint16_t abs_y = (uint16_t)(-dy);
            DP16(r, 0x14) = abs_y;
            if (abs_y < abs_x) {
                // Octant 4: 0xFF80 + angle
                uint16_t ang = divide_octant(r, abs_y, abs_x);
                r->p &= ~SOE_C;
                r->a = soe_adc16(r, ang, 0xFF80);
            } else {
                SOE_AT(0xAFF3);
                // Octant 5: 0xFFC0 - angle
                uint16_t ang = divide_octant(r, abs_x, abs_y);
                r->p &= ~SOE_C;
                r->a = soe_adc16(r, (uint16_t)~ang, 0xFFC1);
            }
        }
    }

    r->db = entry_db;
    soe_nz8(r, entry_db);
}
