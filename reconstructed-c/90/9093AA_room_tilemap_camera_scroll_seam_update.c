/**
 * Routine: $90:93AA (room_tilemap_camera_scroll_seam_update)
 * Bank: $90 (ROM Offset: $1093AA)
 * Calling convention: RTS
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   room_tilemap_camera_scroll_seam_update ($9093AA) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  117 instructions (257 bytes)
 * - Compiled C ASM:   689 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   5.9x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      e80022f7dcee73ed
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "tilemap_viewport.h"

#define BG2_VRAM_NAMETABLE_BASE 0x0400u
#define BG2_METATILE_WORD_OFF   0x0002u

SOE_BIND(room_tilemap_camera_scroll_seam_update, 0x9093AA, RTS);

/**
 * Computes visible BG2 metatile bounds from PPU shadow scroll ($0112/$0114)
 * into $0F94..$0F9A and uploads the 15-row BG2 nametable window to VRAM $0400.
 */
void room_tilemap_camera_scroll_seam_update_bind(soe_regs r) {
    DP16(r, 0x02u) = BG2_VRAM_NAMETABLE_BASE;
    DP16(r, 0x26u) = BG2_METATILE_WORD_OFF;

    uint16_t x_tile = (uint16_t)((ABS16(r, PPU_SHADOW_BG2HOFS_ADDR) & 0x0FF0u) >> 4);
    DP16(r, 0x46u) = x_tile;
    ABS16(r, BG2_METATILE_VIEWPORT_LEFT_ADDR) = x_tile;
    ABS16(r, BG2_METATILE_VIEWPORT_RIGHT_ADDR) = (uint16_t)(x_tile + ABS16(r, ROOM_PALETTE_GROUP_ID_ADDR));

    uint16_t y_tile = (uint16_t)(((ABS16(r, PPU_SHADOW_BG2VOFS_ADDR) + 1u) & 0x0FF0u) >> 4);
    DP16(r, 0x48u) = y_tile;
    ABS16(r, BG2_METATILE_VIEWPORT_TOP_ADDR) = y_tile;
    ABS16(r, BG2_METATILE_VIEWPORT_BOTTOM_ADDR) = (uint16_t)(y_tile + VIEWPORT_HEIGHT_METATILES);

    tilemap_viewport_upload(r, x_tile, BG2_VRAM_NAMETABLE_BASE, BG2_METATILE_WORD_OFF);
}

