/*
 * Routine: sub_8FC7C4 ($8F:C7C4)
 * Screen/camera coordinate projection and depth bounds calculation for entity slot Y.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sub_8FC7C4 ($8FC7C4) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  44 instructions (96 bytes)
 * - Compiled C ASM:   360 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   8.2x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      2024eae8bcbfe889
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(sub_8FC7C4, 0x8FC7C4, RTL) {
    uint16_t a = r->a;
    uint16_t y = r->y;
    DP16(r, 0x06u) = a;

    uint16_t d0c = RAM16(y + 0x000Cu);
    if (d0c == 0u) {
        d0c = 0x0200u;
    }
    // TSB $06: tests (d0c & DP16($06)) and sets bits from d0c
    if ((d0c & DP16(r, 0x06u)) == 0u) {
        r->p |= SOE_Z;
    } else {
        r->p &= (uint8_t)~SOE_Z;
    }
    DP16(r, 0x06u) |= d0c;

    uint16_t rel_x = (uint16_t)(RAM16(y + 0x001Au) - DP16(r, 0x59u));
    DP16(r, 0x02u) = rel_x;

    uint16_t rel_y = (uint16_t)(RAM16(y + 0x001Cu) - DP16(r, 0x5Bu));
    DP16(r, 0x04u) = rel_y;

    uint16_t elev = (uint16_t)(RAM16(y + 0x0018u) & 0x0030u);
    if (elev == 0u) {
        if (RAM16(0x241Fu) == 0x0002u) {
            rel_x = (uint16_t)(RAM16(y + 0x001Au) - RAM16(0x010Eu));
            DP16(r, 0x02u) = rel_x;
            rel_y = (uint16_t)(RAM16(y + 0x001Cu) - RAM16(0x0110u) + 1u);
            DP16(r, 0x04u) = rel_y;
        }
        elev = 0u; // TDC
    }

    uint16_t val = (uint16_t)(elev ^ 0x0030u);
    soe_carry(r, (val & 0x8000u) != 0u);
    val = (uint16_t)(val << 1);
    val = soe_adc16(r, val, 0x0040u);
    val = soe_adc16(r, val, DP16(r, 0x04u));

    if ((val & 0xFE00u) != 0u) {
        // Out of bounds: 8FC81D TDC
        r->a = 0u;
        DP16(r, 0x08u) = 0u;
        RAM16(y + 0x0084u) = 0u;
        r->p = (uint8_t)((r->p & ~SOE_N) | SOE_Z);
    } else {
        r->p &= (uint8_t)~SOE_C;
        val = soe_adc16(r, val, 0x0080u);
        r->a = val;
        DP16(r, 0x08u) = val;
        RAM16(y + 0x0084u) = val;
    }
}

