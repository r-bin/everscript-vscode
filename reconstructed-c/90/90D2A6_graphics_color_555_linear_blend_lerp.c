/**
 * Routine: $90:D2A6 (graphics_color_555_linear_blend_lerp)
 * Bank: $90 (ROM Offset: $10D2A6)
 * Calling convention: RTL (DP $12 = weight 0..255/256, $16 = colorA, $18 = colorB)
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   graphics_color_555_linear_blend_lerp ($90D2A6) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  84 instructions (166 bytes)
 * - Compiled C ASM:   538 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   6.4x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      041fc5767c041484
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

#define RGB555_RED_MASK    0x1Fu
#define RGB555_GREEN_MASK  0x03E0u
#define RGB555_BLUE_MASK   0x7Cu

SOE_BIND(graphics_color_555_linear_blend_lerp, 0x90D2A6, RTL);

static inline uint8_t lerp_channel_hi(soe_regs r, uint8_t c_a, uint8_t c_b) {
    if (c_b >= c_a) {
        ABS8(r, 0x4203u) = (uint8_t)(c_b - c_a);
        return (uint8_t)(c_a + ABS8(r, 0x4217u));
    }
    ABS8(r, 0x4203u) = (uint8_t)(c_a - c_b);
    return (uint8_t)(c_a - ABS8(r, 0x4217u));
}

/**
 * Linearly interpolates between two 15-bit BGR555 colors in DP $16 and $18
 * using the 8-bit blend weight in DP $12 (non-zero high byte with zero low
 * byte returns $18; zero weight returns $16), returning the blended color in A.
 */
void graphics_color_555_linear_blend_lerp_bind(soe_regs r) {
    uint16_t factor = DP16(r, 0x12u);
    if ((factor & 0x00FFu) == 0u) {
        uint16_t res = (factor != 0u) ? DP16(r, 0x18u) : DP16(r, 0x16u);
        r->a = res;
        soe_nz16(r, res);
        return;
    }

    ABS16(r, 0x4202u) = factor;

    uint16_t color_a = DP16(r, 0x16u);
    uint16_t color_b = DP16(r, 0x18u);

    uint8_t green_a = (uint8_t)((color_a & RGB555_GREEN_MASK) >> 2);
    uint8_t green_b = (uint8_t)((color_b & RGB555_GREEN_MASK) >> 2);
    DP8(r, 0x1Au) = green_a;
    DP8(r, 0x1Bu) = green_b;

    uint8_t red_a = (uint8_t)(color_a & RGB555_RED_MASK);
    uint8_t red_b = (uint8_t)(color_b & RGB555_RED_MASK);
    uint8_t red_out = lerp_channel_hi(r, red_a, red_b);
    DP8(r, 0x1Cu) = red_out;

    uint8_t blue_a = (uint8_t)((color_a >> 8) & RGB555_BLUE_MASK);
    uint8_t blue_b = (uint8_t)((color_b >> 8) & RGB555_BLUE_MASK);
    uint8_t blue_out;
    if (blue_b >= blue_a) {
        ABS8(r, 0x4203u) = (uint8_t)(blue_b - blue_a);
        blue_out = (uint8_t)((blue_a + ABS8(r, 0x4217u)) & RGB555_BLUE_MASK);
    } else {
        ABS8(r, 0x4203u) = (uint8_t)(blue_a - blue_b);
        blue_out = (uint8_t)(((blue_a | 0x03u) - ABS8(r, 0x4217u)) & RGB555_BLUE_MASK);
    }
    DP8(r, 0x1Du) = blue_out;

    uint8_t green_out;
    if (green_b >= green_a) {
        ABS8(r, 0x4203u) = (uint8_t)(green_b - green_a);
        soe_carry(r, false);
        green_out = soe_adc8(r, green_a, ABS8(r, 0x4217u));
    } else {
        ABS8(r, 0x4203u) = (uint8_t)(green_a - green_b);
        soe_carry(r, true);
        green_out = soe_sbc8(r, (uint8_t)(green_a | 0x07u), ABS8(r, 0x4217u));
    }

    uint16_t result = (uint16_t)((((uint16_t)(green_out & 0xF8u)) << 2) | DP16(r, 0x1Cu));
    r->a = result;
    r->p &= (uint8_t)~(SOE_M | SOE_X | SOE_C);
    soe_nz16(r, result);
}
