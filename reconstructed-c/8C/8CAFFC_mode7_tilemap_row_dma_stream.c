/*
 * $8C:AFFC mode7_tilemap_row_dma_stream (knowledge/routines/mode7_tilemap_row_dma_stream.md), RTL.
 *
 * Programs Mode 7 matrix A ($211B) from A and B ($211C) = 1, multiplies DP $04 by $20,
 * and streams DP $08 tilemap rows of width DP $06 words from $7F:C800+ to $2134 via DMA ch 1.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   mode7_tilemap_row_dma_stream ($8CAFFC) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  40 instructions (83 bytes)
 * - Compiled C ASM:   379 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   9.5x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      f574329a1f18b408
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(mode7_tilemap_row_dma_stream, 0x8CAFFC, RTL)
{
    uint16_t y, mul_in, prod, a_val, x, sz;
    uint32_t sum;
    uint8_t v_flag = 0, c_flag = 0;

    ABS8(r, 0x211B) = (uint8_t)(r->a & 0xFFu);
    ABS8(r, 0x211B) = (uint8_t)(r->a >> 8);
    ABS8(r, 0x211C) = 0x01u;

    y = DP16(r, 0x08);
    mul_in = (uint16_t)(DP16(r, 0x04) | 0x2000u);
    ABS16(r, 0x4202) = mul_in;
    prod = ABS16(r, 0x4216);

    sum = (uint32_t)DP16(r, 0x02) + (uint32_t)prod;
    a_val = (uint16_t)sum;
    DP16(r, 0x0A) = a_val;

    x = (uint16_t)((uint16_t)(a_val << 1) + 0xC800u);
    a_val = x;

    do {
        ABS16(r, 0x4312) = a_val;
        sz = DP16(r, 0x06);
        ABS16(r, 0x4315) = (uint16_t)(sz << 1);
        ABS8(r, 0x4314) = 0x7Fu;
        ABS8(r, 0x4310) = 0x81u;
        ABS8(r, 0x4311) = 0x34u;
        ABS8(r, 0x420B) = 0x02u;

        sum = (uint32_t)x + 0x0040u;
        a_val = (uint16_t)sum;
        v_flag = ((~(x ^ 0x0040u) & (x ^ a_val) & 0x8000u) != 0) ? 1u : 0u;
        c_flag = (sum > 0xFFFFu) ? 1u : 0u;
        x = a_val;
        y = (uint16_t)(y - 1u);
    } while (y != 0);

    r->a = a_val;
    r->x = x;
    r->y = 0;
    r->p &= (uint8_t)~(SOE_M | SOE_N | SOE_V | SOE_C);
    r->p |= (uint8_t)(SOE_Z | (v_flag ? SOE_V : 0) | (c_flag ? SOE_C : 0));
}

