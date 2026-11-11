/*
 * $8C:9DAF font_metrics_table_setup (knowledge/routines/font_metrics_table_setup.md), RTL.
 *
 * Reads font header bytes from $C4:0000+X into DP $90/$94 and $0B3D/$0B3F/$0B41/$0B43,
 * computing character stride and base ROM pointer in DP $92 via hardware multiplier $4202.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   font_metrics_table_setup ($8C9DAF) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  24 instructions (56 bytes)
 * - Compiled C ASM:   264 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   11.0x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      a2ce44eba8d0900b
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(font_metrics_table_setup, 0x8C9DAF, RTL)
{
    uint16_t x = r->x;
    uint8_t glyph_h;
    uint8_t char_w;
    uint16_t mul_in;
    uint16_t stride;
    uint16_t sum;

    DP16(r, 0x90) = x;
    DP8(r, 0x94) = 0xC4u;

    glyph_h = ROM8(0xC40000UL + x);
    x = (uint16_t)(x + 1u);
    ABS8(r, FONT_GLYPH_HEIGHT_ADDR) = glyph_h;

    char_w = ROM8(0xC40000UL + x);
    x = (uint16_t)(x + 1u);
    ABS8(r, DIALOGUE_AUDIO_BEEP_TICK_ADDR) = char_w;

    mul_in = (uint16_t)(((uint16_t)glyph_h << 8) | char_w);
    ABS16(r, 0x4202) = mul_in;
    ABS16(r, FONT_BUFFER_BASE_ADDR) = x;
    stride = ABS16(r, 0x4216);
    ABS16(r, FONT_LINE_STRIDE_ADDR) = stride;

    ABS16(r, 0x4202) = (uint16_t)(stride | 0x8000u);
    soe_carry(r, false);
    sum = soe_adc16(r, ABS16(r, FONT_BUFFER_BASE_ADDR), ABS16(r, 0x4216));
    DP16(r, 0x92) = sum;

    r->a = sum;
    r->x = x;
    r->p &= (uint8_t)~SOE_M;
}
