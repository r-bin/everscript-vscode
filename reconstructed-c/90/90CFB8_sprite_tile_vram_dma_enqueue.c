/*
 * $90:CFB8 sprite_tile_vram_dma_enqueue (knowledge/routines/sprite_tile_vram_dma_enqueue.md), RTL, 16-bit A, X, Y.
 *
 * Sets up a palette DMA transfer from bank $90 using $80:85FA while preserving X, Y, and DB.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sprite_tile_vram_dma_enqueue ($90CFB8) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  33 instructions (54 bytes)
 * - Compiled C ASM:   258 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   7.8x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      949ae6946b6d38aa
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

void cgram_palette_dma_enqueue_or_immediate_bind(soe_regs r);

SOE_BIND(sprite_tile_vram_dma_enqueue, 0x90CFB8, RTL)
{
    uint16_t entry_x = r->x;
    uint16_t entry_y = r->y;
    uint8_t entry_db = r->db;

    SOE_AT(0xCFB8);
    r->y = 0x010F;
    r->db = 0x90;
    DP16(r, 0x26) = r->a;
    DP16(r, 0x2E) = 0x0001;
    r->p &= ~SOE_C;
    r->a = soe_adc16(r, 0x0002, DP16(r, 0x26));
    DP16(r, 0x26) = r->a;
    DP16(r, 0x28) = 0x0090;

    r->a = r->x;
    soe_carry(r, (r->a & 0x8000) != 0);
    r->a = (uint16_t)(r->a << 1);
    soe_carry(r, (r->a & 0x8000) != 0);
    r->a = (uint16_t)(r->a << 1);
    soe_carry(r, (r->a & 0x8000) != 0);
    r->a = (uint16_t)(r->a << 1);
    r->a = soe_adc16(r, r->a, 0x0080);
    r->a = soe_adc16(r, r->a, DP16(r, 0x2E));
    DP16(r, 0x2E) = r->a;

    r->a = 0x001E;
    r->x = 0x001E;
    soe_carry(r, false);
    soe_nz16(r, 0x001E);
    cgram_palette_dma_enqueue_or_immediate_bind(r);

    r->db = entry_db;
    r->y = entry_y;
    r->x = entry_x;
    soe_nz16(r, entry_x);
}
