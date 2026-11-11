#ifndef SOE_TILEMAP_VIEWPORT_H
#define SOE_TILEMAP_VIEWPORT_H

#include "soe.h"
#include "soe_ram.h"

#define VIEWPORT_HEIGHT_METATILES 0x000Fu
#define TILEMAP_SCREEN_COLS       0x0020u
#define VRAM_CLEAR_BYTES          0x0800u
#define VRAM_DMA_ZERO_SRC_ADDR    0x8000u
#define VRAM_DMA_ZERO_SRC_BANK    0x80u

/**
 * Shared VRAM DMA clear + 15-row wrapped tilemap seam upload helper entered at
 * $90:93DF from both BG1 ($90:9379) and BG2 ($90:93AA) viewport setup routines.
 */
static inline void tilemap_viewport_upload(soe_regs r, uint16_t x_tile, uint16_t vram_base, uint16_t word_off) {
    ABS16(r, 0x2116u) = vram_base;
    ABS16(r, 0x4310u) = 0x1809u;
    ABS16(r, 0x4315u) = VRAM_CLEAR_BYTES;
    ABS16(r, 0x4312u) = VRAM_DMA_ZERO_SRC_ADDR;
    ABS8(r, 0x4314u) = VRAM_DMA_ZERO_SRC_BANK;
    ABS8(r, 0x420Bu) = 0x02u;

    ABS16(r, 0x4202u) = (uint16_t)(DP16(r, 0x47u) | ABS16(r, ROOM_METATILE_WIDTH_ADDR));
    uint16_t tile_map_off = (uint16_t)((x_tile + ABS16(r, 0x4216u)) << 1);
    DP16(r, 0x0Au) = tile_map_off;

    uint16_t vram_row = (uint16_t)(((DP16(r, 0x47u) & 0x1F00u) >> 3) + vram_base);
    uint16_t vram_addr = (uint16_t)(vram_row | (x_tile & 0x001Fu));
    DP16(r, 0x0Cu) = vram_addr;

    uint16_t screen_cols = RAM16(ROOM_PALETTE_GROUP_ID_ADDR);
    int16_t overflow = (int16_t)((x_tile & 0x001Fu) - TILEMAP_SCREEN_COLS + screen_cols);
    uint16_t wrap_cols = (overflow >= 0) ? (uint16_t)overflow : r->d;
    DP16(r, 0x08u) = wrap_cols;

    uint16_t first_cols = (uint16_t)(screen_cols - wrap_cols);
    DP16(r, 0x46u) = first_cols;
    DP16(r, 0x14u) = VIEWPORT_HEIGHT_METATILES;

    IO8(0x2115u) = 0x80u;

    uint16_t x = tile_map_off;
    uint16_t y = r->y;
    bool last_c = false;

    for (uint16_t row = VIEWPORT_HEIGHT_METATILES; row != 0u; row--) {
        DP16(r, 0x12u) = first_cols;
        IO16(0x2116u) = vram_addr;
        x = tile_map_off;
        for (uint16_t col = first_cols; col != 0u; col--) {
            y = LONG16(0x7F0000u | x);
            IO16(0x2118u) = LONG16(0x7F0000u | (uint16_t)(word_off + y));
            x = (uint16_t)(x + 2u);
        }
        if (wrap_cols != 0u) {
            DP16(r, 0x12u) = wrap_cols;
            IO16(0x2116u) = (uint16_t)(vram_addr & 0xFFE0u);
            for (uint16_t col = wrap_cols; col != 0u; col--) {
                y = LONG16(0x7F0000u | x);
                IO16(0x2118u) = LONG16(0x7F0000u | (uint16_t)(word_off + y));
                x = (uint16_t)(x + 2u);
            }
        }
        DP16(r, 0x12u) = 0u;
        vram_addr = (uint16_t)(((vram_addr + TILEMAP_SCREEN_COLS) & 0x03FFu) | vram_base);
        DP16(r, 0x0Cu) = vram_addr;

        soe_carry(r, false);
        tile_map_off = soe_adc16(r, tile_map_off, RAM16(ROOM_TILE_WIDTH_ADDR));
        DP16(r, 0x0Au) = tile_map_off;
        last_c = (r->p & SOE_C) != 0;
    }

    DP16(r, 0x14u) = 0u;
    r->a = tile_map_off;
    r->x = x;
    r->y = y;
    r->p &= (uint8_t)~(SOE_M | SOE_X);
    soe_nz8(r, r->db);
    soe_carry(r, last_c);
}

#endif
