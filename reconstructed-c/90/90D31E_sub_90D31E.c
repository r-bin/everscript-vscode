/*
 * Routine: sub_90D31E ($90:D31E)
 * Graphics / Palette subsystem: linearly interpolates the green color channel
 * using SNES hardware math registers ($4203 / $4217) and packs the final 15-bit
 * BGR555 color with red/blue from DP $1C.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sub_90D31E ($90D31E) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  24 instructions (46 bytes)
 * - Compiled C ASM:   216 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   9.0x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      3b0ffc4cbd201f2d
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(sub_90D31E, 0x90D31E, RTL) {
    uint8_t a = (uint8_t)(r->a & 0x7Cu);
    DP8(r, 0x1Du) = a;

    uint8_t g_b = DP8(r, 0x1Bu);
    uint8_t g_a = DP8(r, 0x1Au);

    if (g_b >= g_a) {
        ABS8(r, 0x4203u) = (uint8_t)(g_b - g_a);
        soe_carry(r, false);
        a = soe_adc8(r, g_a, ABS8(r, 0x4217u));
    } else {
        ABS8(r, 0x4203u) = (uint8_t)(g_a - g_b);
        soe_carry(r, true);
        a = soe_sbc8(r, (uint8_t)(g_a | 0x07u), ABS8(r, 0x4217u));
    }

    r->p &= (uint8_t)~(SOE_M | SOE_X | SOE_C);

    uint16_t result = (uint16_t)((((uint16_t)(a & 0xF8u)) << 2) | DP16(r, 0x1Cu));
    r->a = result;
    soe_nz16(r, result);
}
