/*
 * Routine: $91:CBB1 (spell_projectile_polar_to_cartesian_trajectory_calc)
 * Calculates trajectory step vector and updates projectile coordinates $46/$48.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   spell_projectile_polar_to_cartesian_trajectory_calc ($91CBB1) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  55 instructions (100 bytes)
 * - Compiled C ASM:   464 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   8.4x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      b244493ded15ac40
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

extern void math_vector_2d_angle_and_distance_calc_bind(soe_regs r);
extern void random_number_generator_bind(soe_regs r);

SOE_BIND(spell_projectile_polar_to_cartesian_trajectory_calc, 0x91CBB1, RTL) {
    int16_t dx = (int16_t)(DP16(r, 0x3Eu) - DP16(r, 0x46u));
    DP16(r, 0x02u) = (uint16_t)dx;

    int16_t dy = (int16_t)(DP16(r, 0x40u) - DP16(r, 0x48u));
    DP16(r, 0x04u) = (uint16_t)dy;

    math_vector_2d_angle_and_distance_calc_bind(r);

    uint16_t angle = r->a;
    DP16(r, 0x02u) = angle;

    uint16_t d12 = DP16(r, 0x12u);
    uint16_t d14 = DP16(r, 0x14u);
    uint16_t max_d = (d12 >= d14) ? d12 : d14;

    if (max_d < 0x000Cu) {
        r->a = max_d;
        (void)soe_cmp16(r, max_d, 0x000Cu);
        soe_carry(r, false);
        return;
    }

    /* 91cbcd CMP #$000C; BCS $91CBD4: carry is 1 on branch */
    soe_carry(r, true);
    random_number_generator_bind(r);

    uint16_t a = (uint16_t)(r->a & 0x007Fu);
    bool c_lsr = (a & 1u) != 0u;
    a >>= 1;
    soe_carry(r, c_lsr);
    a = soe_sbc16(r, a, 0x0020u);
    a = soe_adc16(r, a, DP16(r, 0x02u));
    a &= 0x00F8u;
    DP16(r, 0x02u) = a;

    a >>= 3;
    a ^= 0xFFFFu;
    soe_carry(r, true);
    a = soe_adc16(r, a, DP16(r, 0x02u));
    uint16_t y = a;
    r->y = y;

    DP16(r, 0x02u) = DP16(r, 0x46u);
    DP16(r, 0x04u) = DP16(r, 0x48u);

    uint32_t ptr = SOE_DPPTR(r, 0x2Eu);
    DP16(r, 0x26u) = LONG16(ptr + y);
    y += 2u;
    DP16(r, 0x28u) = LONG16(ptr + y);
    y += 1u;
    uint16_t step_x = LONG16(ptr + y);
    soe_carry(r, false);
    DP16(r, 0x46u) = soe_adc16(r, step_x, DP16(r, 0x46u));
    y += 2u;
    uint16_t step_y = LONG16(ptr + y);
    soe_carry(r, false);
    uint16_t new_y = soe_adc16(r, step_y, DP16(r, 0x48u));
    DP16(r, 0x48u) = new_y;

    r->y = y;
    r->a = new_y;
    soe_nz16(r, new_y);
    soe_carry(r, true);
}
