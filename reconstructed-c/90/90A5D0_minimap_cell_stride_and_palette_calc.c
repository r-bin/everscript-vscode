/*
 * $90:A5D0 minimap_cell_stride_and_palette_calc (knowledge/routines/minimap_cell_stride_and_palette_calc.md), RTS.
 *
 * Computes minimap screen buffer destination offset and extracts palette bits.
 * Sets up hardware multiplier for Y * map_width, derives target bounding box ($0FB8..$0FC0),
 * screen buffer address in $0FB6 / DP $AD, extracts palette bits (attr & 0x1F00) >> 3 into $0FB4,
 * and flags DMA commit trigger at $0FC2.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   minimap_cell_stride_and_palette_calc ($90A5D0) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  62 instructions (128 bytes)
 * - Compiled C ASM:   699 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   11.3x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      2650fe3b5ccfd847
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(minimap_cell_stride_and_palette_calc, 0x90A5D0, RTS)
{
    uint16_t a_in = r->a;
    uint16_t x_in = r->x;
    uint16_t y;
    uint16_t a;
    uint16_t pushed_y;
    uint32_t ptr_8b;
    uint32_t ptr_aa;

    uint16_t mul1 = (uint16_t)((a_in & 0x00FFu) | 0x0500u);
    ABS16(r, 0x4202) = mul1;

    DP16(r, 0xB1) = DP16(r, 0x8C);

    a = (uint16_t)(x_in << 1);
    soe_carry(r, (x_in & 0x8000u) != 0);
    a = soe_adc16(r, a, ABS16(r, 0x0FA2));
    y = a;

    ptr_8b = SOE_DPPTR(r, 0x8B);
    a = LONG16(ptr_8b + y);

    soe_carry(r, true);
    a = soe_adc16(r, a, ABS16(r, 0x4216));
    y = a;
    pushed_y = y;

    ptr_aa = SOE_DPPTR(r, 0xAA);
    y = (uint16_t)(y + 1u);
    a = LONG16(ptr_aa + y);
    y = (uint16_t)(y + 1u);
    a &= 0x00FFu;
    ABS16(r, 0x0FBC) = a;
    ABS16(r, 0x0FB8) = a;

    a = LONG16(ptr_aa + y);
    y = (uint16_t)(y + 1u);
    a &= 0x00FFu;
    ABS16(r, 0x0FBA) = a;

    a = (uint16_t)((a << 8) | ABS16(r, 0x08EE));
    ABS16(r, 0x4202) = a;

    a = LONG16(ptr_aa + y);
    y = a;

    a = LONG16(ptr_aa + y);
    y = (uint16_t)(y + 1u);
    a &= 0x00FFu;
    soe_carry(r, false);
    a = soe_adc16(r, a, ABS16(r, 0x0FB8));
    ABS16(r, 0x0FBE) = a;

    a = LONG16(ptr_aa + y);
    a &= 0x00FFu;
    soe_carry(r, false);
    a = soe_adc16(r, a, ABS16(r, 0x0FBA));
    ABS16(r, 0x0FC0) = a;

    soe_carry(r, true);
    a = soe_adc16(r, y, DP16(r, 0xAA));
    DP16(r, 0xB0) = a;

    DP16(r, 0xAE) = 0x7F00u;

    soe_carry(r, false);
    a = soe_adc16(r, ABS16(r, 0x0FB8), ABS16(r, 0x4216));
    soe_carry(r, (a & 0x8000u) != 0);
    a = (uint16_t)(a << 1);
    DP16(r, 0xAD) = a;
    ABS16(r, 0x0FB6) = a;

    a = ABS16(r, 0x0FB9);
    a &= 0x1F00u;
    a = (uint16_t)(a >> 1);
    a = (uint16_t)(a >> 1);
    soe_carry(r, (a & 0x0001u) != 0);
    a = (uint16_t)(a >> 1);
    ABS16(r, 0x0FB4) = a;

    a = 0x0001u;
    ABS16(r, 0x0FC2) = a;

    r->a = a;
    r->y = pushed_y;
    soe_nz16(r, r->y);
}

