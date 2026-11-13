/*
 * $8D:B478 sram_compute_checksum (knowledge/routines/sram_compute_checksum.md), RTL, 16-bit A, X, Y.
 *
 * Computes the 16-bit rolling checksum over Y bytes starting at DB:X, seeded with $043F.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sram_compute_checksum ($8DB478) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  14 instructions (26 bytes)
 * - Compiled C ASM:   234 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   16.7x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      8e624e048080690f
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(sram_compute_checksum, 0x8DB478, RTL)
{
    uint16_t a = 0x043F;
    uint16_t x = r->x;
    uint16_t y = r->y;

    SOE_AT(0xB478);
    r->a = a;
    r->p = (uint8_t)((r->p | SOE_M) & ~SOE_C);
    if (y == 1) {
        soe_set_a8(r, soe_adc8(r, 0x3F, ABSI8(r, 0x0000, x)));
        SOE_AT(0xB481);
        r->y = 0;
        soe_nz16(r, 0);
        SOE_AT(0xB48F);
        r->p &= ~SOE_M;
        return;
    }
    a = (uint16_t)(0x0400 | ((0x3F + ABSI8(r, 0x0000, x)) & 0x00FF));
    for (;;) {
        SOE_AT(0xB481);
        y = (uint16_t)(y - 1);
        SOE_AT(0xB484);
        x = (uint16_t)(x + 1);
        if (y == 1) {
            r->p &= ~SOE_M;
            soe_carry(r, (a & 0x8000) != 0);
            r->a = (uint16_t)(a << 1);
            r->p |= SOE_M;
            soe_set_a8(r, soe_adc8(r, SOE_A8(r), ABSI8(r, 0x0000, x)));
            r->x = x;
            r->y = 0;
            soe_nz16(r, 0);
            break;
        }
        {
            uint16_t c = (a >> 15) & 1;
            a = (uint16_t)(a << 1);
            a = (uint16_t)((a & 0xFF00) | (((a & 0x00FF) + ABSI8(r, 0x0000, x) + c) & 0x00FF));
        }
    }
    SOE_AT(0xB48F);
    r->p &= ~SOE_M;
}
