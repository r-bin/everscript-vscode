/**
 * Routine: $90:9379 (calc_visible_tilemap_bounds_from_scroll)
 * Bank: $90 (ROM Offset: $109379)
 * Calling convention: RTS
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   calc_visible_tilemap_bounds_from_scroll ($909379) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  116 instructions (253 bytes)
 * - Compiled C ASM:   682 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   5.9x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      5736393ae91a6b66
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "tilemap_viewport.h"

#define BG1_VRAM_NAMETABLE_BASE 0x0000u
#define BG1_METATILE_WORD_OFF   0x0000u

SOE_BIND(calc_visible_tilemap_bounds_from_scroll, 0x909379, RTS);

/**
 * Computes visible BG1 metatile bounds from PPU shadow scroll ($010E/$0110)
 * into $0F8C..$0F92 and uploads the 15-row BG1 nametable window to VRAM $0000.
 */
void calc_visible_tilemap_bounds_from_scroll_bind(soe_regs r) {
    DP16(r, 0x02u) = BG1_VRAM_NAMETABLE_BASE;
    DP16(r, 0x26u) = BG1_METATILE_WORD_OFF;

    uint16_t x_tile = (uint16_t)((ABS16(r, PPU_SHADOW_BG1HOFS_ADDR) & 0x0FF0u) >> 4);
    DP16(r, 0x46u) = x_tile;
    ABS16(r, MINIMAP_RADAR_WINDOW_LEFT_ADDR) = x_tile;
    ABS16(r, MINIMAP_RADAR_WINDOW_RIGHT_ADDR) = (uint16_t)(x_tile + ABS16(r, ROOM_PALETTE_GROUP_ID_ADDR));

    uint16_t y_tile = (uint16_t)(((ABS16(r, PPU_SHADOW_BG1VOFS_ADDR) + 1u) & 0x0FF0u) >> 4);
    DP16(r, 0x48u) = y_tile;
    ABS16(r, MINIMAP_RADAR_WINDOW_TOP_ADDR) = y_tile;
    ABS16(r, MINIMAP_RADAR_WINDOW_BOTTOM_ADDR) = (uint16_t)(y_tile + VIEWPORT_HEIGHT_METATILES);

    tilemap_viewport_upload(r, x_tile, BG1_VRAM_NAMETABLE_BASE, BG1_METATILE_WORD_OFF);
}

