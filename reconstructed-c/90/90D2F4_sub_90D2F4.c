/*
 * Routine: sub_90D2F4 ($90:D2F4)
 * Graphics / Palette subsystem: stores red channel to DP $1C, linearly interpolates
 * the blue and green channels using SNES hardware math registers ($4203 / $4217),
 * and packs the final 15-bit BGR555 color into A.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sub_90D2F4 ($90D2F4) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  45 instructions (88 bytes)
 * - Compiled C ASM:   388 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   8.6x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      2624751d52b0033d
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(sub_90D2F4, 0x90D2F4, RTL) {
    // 90:D2F4 STA $1C
    DP8(r, 0x1Cu) = (uint8_t)r->a;

    // Blue channel interpolation
    uint8_t blue_a = (uint8_t)(DP8(r, 0x17u) & 0x7Cu);
    DP8(r, 0x1Du) = blue_a;
    uint8_t blue_b = (uint8_t)(DP8(r, 0x19u) & 0x7Cu);

    uint8_t blue_out;
    if (blue_b >= blue_a) {
        ABS8(r, 0x4203u) = (uint8_t)(blue_b - blue_a);
        soe_carry(r, false);
        blue_out = soe_adc8(r, blue_a, ABS8(r, 0x4217u));
    } else {
        ABS8(r, 0x4203u) = (uint8_t)(blue_a - blue_b);
        soe_carry(r, true);
        blue_out = soe_sbc8(r, (uint8_t)(blue_a | 0x03u), ABS8(r, 0x4217u));
    }

    // 90:D31E AND #$7C; STA $1D
    DP8(r, 0x1Du) = (uint8_t)(blue_out & 0x7Cu);

    // Green channel interpolation
    uint8_t g_b = DP8(r, 0x1Bu);
    uint8_t g_a = DP8(r, 0x1Au);

    uint8_t green_out;
    if (g_b >= g_a) {
        ABS8(r, 0x4203u) = (uint8_t)(g_b - g_a);
        soe_carry(r, false);
        green_out = soe_adc8(r, g_a, ABS8(r, 0x4217u));
    } else {
        ABS8(r, 0x4203u) = (uint8_t)(g_a - g_b);
        soe_carry(r, true);
        green_out = soe_sbc8(r, (uint8_t)(g_a | 0x07u), ABS8(r, 0x4217u));
    }

    // 90:D342 REP #$30
    r->p &= (uint8_t)~(SOE_M | SOE_X | SOE_C);

    // 90:D344 AND #$00F8; ASL A; ASL A; ORA $1C
    uint16_t result = (uint16_t)((((uint16_t)(green_out & 0xF8u)) << 2) | DP16(r, 0x1Cu));
    r->a = result;
    soe_nz16(r, result);
}
