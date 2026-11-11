/*
 * $8C:B5A4 dialogue_window_glyph_vram_buffer_alloc (knowledge/routines/dialogue_window_glyph_vram_buffer_alloc.md), RTL.
 *
 * Computes the tile slot offset in $7F:C800 for a dialogue window glyph (unless bit 0 of +$2A,Y is set),
 * writes $E572 there, sets DP $26/$28/$2E, X = 2, and tail-calls vram_dma_upload_tile_block ($80:8650).
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   dialogue_window_glyph_vram_buffer_alloc ($8CB5A4) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  31 instructions (73 bytes)
 * - Compiled C ASM:   300 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   9.7x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      7406b7d9741d4161
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

void vram_dma_upload_tile_block_bind(soe_regs r);

SOE_BIND(dialogue_window_glyph_vram_buffer_alloc, 0x8CB5A4, RTL)
{
    uint16_t y = r->y;
    uint16_t flags = ABSI16(r, 0x002A, y);
    uint16_t row_base;
    uint16_t tile_idx;
    uint16_t x;
    uint16_t a;

    r->a = flags;
    soe_nz16(r, flags);
    soe_bit_imm(r, flags, 0x0001u);
    if (!(r->p & SOE_Z)) {
        return;
    }

    row_base = (uint16_t)(ABSI16(r, 0x0014, y) + ABSI16(r, 0x001E, y));
    ABS16(r, 0x4202) = (uint16_t)(row_base | 0x2000u);

    soe_carry(r, false);
    a = soe_adc16(r, ABSI16(r, 0x0016, y), ABSI16(r, 0x001C, y));
    a = soe_adc16(r, a, ABS16(r, 0x4216));
    tile_idx = soe_adc16(r, a, 0xFFFEu);
    DP16(r, 0x12) = tile_idx;

    x = (uint16_t)(tile_idx << 1);
    LONG16(0x7FC800UL + x) = 0xE572u;

    DP16(r, 0x26) = (uint16_t)(x + 0xC800u);
    DP16(r, 0x28) = 0x007Fu;

    soe_carry(r, false);
    a = soe_adc16(r, tile_idx, 0x0800u);
    DP16(r, 0x2E) = a;

    r->a = a;
    r->x = 0x0002u;
    soe_nz16(r, 0x0002u);
    vram_dma_upload_tile_block_bind(r);
}

