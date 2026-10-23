/*
 * Routine: $8CA5AC (dialogue_glyphs)
 * Bank: $8C (ROM Offset: $0CA5AC)
 * Source: docs/disassembly/ui/dialogue-glyphs.md
 */

#include <stdint.h>
#include <stdbool.h>

// Direct Page Register Mappings
#define DP_CHAR_OFFSET        (*(volatile uint16_t*)0x02)
#define DP_COLOR_MASK         (*(volatile uint16_t*)0x04)
#define DP_SUBPIXEL_SHIFT     (*(volatile uint16_t*)0x06)
#define DP_GLYPH_INDEX        (*(volatile uint16_t*)0x08)
#define DP_TILE_COL0_ADDR     (*(volatile uint16_t*)0x0A)
#define DP_TILE_COL1_ADDR     (*(volatile uint16_t*)0x0C)
#define DP_PLANE0_WORD        (*(volatile uint16_t*)0x0E)
#define DP_PLANE1_WORD        (*(volatile uint16_t*)0x10)
#define DP_ROW_OFFSET         (*(volatile uint16_t*)0x12)
#define DP_DMA_SRC_ADDR       (*(volatile uint16_t*)0x26)
#define DP_DMA_SRC_BANK       (*(volatile uint8_t*)0x28)
#define DP_DMA_DEST_VRAM      (*(volatile uint16_t*)0x2E)
#define DP_ROW_COUNTER        (*(volatile uint16_t*)0x32)
#define DP_CHAR_WIDTH         (*(volatile uint16_t*)0x42)
#define DP_CURSOR_X           (*(volatile uint16_t*)0x46)
#define DP_CURSOR_Y           (*(volatile uint16_t*)0x48)

// WRAM Global Variables
#define WRAM_VRAM_LOCK        (*(volatile uint16_t*)0x7E0F3A)
#define WRAM_DISPLAY_FLAGS    (*(volatile uint16_t*)0x7E0106)
#define WRAM_GLYPH_HEIGHT     (*(volatile uint16_t*)0x7E0B3D)
#define WRAM_LINE_STRIDE      (*(volatile uint16_t*)0x7E0B3F)
#define WRAM_BUFFER_BASE      (*(volatile uint16_t*)0x7E0B41)

// Hardware SNES Registers
#define REG_VMAIN             (*(volatile uint8_t*)0x2115)
#define REG_VMADD             (*(volatile uint16_t*)0x2116)
#define REG_DMA1_MODE         (*(volatile uint16_t*)0x4310)
#define REG_DMA1_ADDR         (*(volatile uint16_t*)0x4312)
#define REG_DMA1_BANK         (*(volatile uint8_t*)0x4314)
#define REG_DMA1_COUNT        (*(volatile uint16_t*)0x4315)
#define REG_MDMAEN            (*(volatile uint8_t*)0x420B)

// Font Master Tables
extern const uint8_t  g_font_glyph_bitmaps[]; // $C4:0000
extern const uint8_t  g_font_char_widths[];   // $C4:0C02

/**
 * Uploads a block of graphical tile data directly to VRAM via DMA channel 1.
 * ROM Address: $80:8650
 */
void vram_dma_upload_tile_block(uint16_t vram_dest, const void* src, uint8_t src_bank, uint16_t byte_count) {
    // If bit 7 of display flags is set, bypass immediate transfer
    if (WRAM_DISPLAY_FLAGS & 0x80) {
        return;
    }

    // Lock VRAM to ensure atomic PPU update
    WRAM_VRAM_LOCK++;

    // Configure PPU VRAM word write mode
    REG_VMAIN = 0x80;
    REG_VMADD = vram_dest;

    // Configure DMA Channel 1 (word transfer to $2118)
    REG_DMA1_MODE  = 0x1801;
    REG_DMA1_ADDR  = (uint16_t)(uintptr_t)src;
    REG_DMA1_BANK  = src_bank;
    REG_DMA1_COUNT = byte_count;

    // Trigger DMA Channel 1
    REG_MDMAEN = 0x02;

    // Release VRAM lock
    WRAM_VRAM_LOCK--;
}

/**
 * Commits the rasterized 2bpp tile buffers into VRAM and advances cursor.
 * ROM Address: $8C:A753
 */
void dialogue_glyph_stream_vram(uint8_t char_code) {
    // Prepare DMA channel 1 parameters from Direct Page
    DP_DMA_SRC_BANK = 0x7F;
    DP_DMA_SRC_ADDR = DP_TILE_COL0_ADDR;
    DP_DMA_DEST_VRAM = DP_TILE_COL1_ADDR;

    // Calculate byte count: (glyph_height + 1) * 2 bytes
    uint16_t byte_count = (WRAM_GLYPH_HEIGHT + 1) << 1;

    // Perform hardware DMA block upload
    vram_dma_upload_tile_block(
        DP_DMA_DEST_VRAM,
        (const void*)(uintptr_t)DP_DMA_SRC_ADDR,
        DP_DMA_SRC_BANK,
        byte_count
    );

    // Look up proportional font width and advance cursor X
    uint8_t glyph_width = g_font_char_widths[char_code & 0x7F];
    DP_CURSOR_X += glyph_width;
}

/**
 * Blits shifted bitplanes into 2bpp SNES tile memory across adjacent tiles.
 */
static inline void blit_shifted_glyph_row(uint8_t* tile_buf, uint16_t col0_offset, uint16_t col1_offset,
                                          uint16_t plane0, uint16_t plane1, uint16_t color_mode) {
    // Left Tile (Column 0): high byte of shifted word
    uint8_t left_p0 = (uint8_t)(plane0 >> 8);
    uint8_t left_p1 = (uint8_t)(plane1 >> 8);

    // Right Tile (Column 1): low byte of shifted word
    uint8_t right_p0 = (uint8_t)(plane0 & 0xFF);
    uint8_t right_p1 = (uint8_t)(plane1 & 0xFF);

    if (color_mode & 0x01) {
        // Shadow / inverted background pass
        tile_buf[col0_offset + 0] = (tile_buf[col0_offset + 0] & ~left_p1) | left_p0;
        tile_buf[col0_offset + 1] |= left_p1;

        tile_buf[col1_offset + 0] = (tile_buf[col1_offset + 0] & ~right_p1) | right_p0;
        tile_buf[col1_offset + 1] |= right_p1;
    } else {
        // Standard foreground pass
        tile_buf[col0_offset + 0] |= left_p0;
        tile_buf[col0_offset + 1] |= left_p1;

        tile_buf[col1_offset + 0] |= right_p0;
        tile_buf[col1_offset + 1] |= right_p1;
    }
}

/**
 * Renders a single character glyph into the dialogue window tile buffer.
 * ROM Address: $8C:A5AC
 */
void dialogue_glyph_render_char(uint8_t char_code) {
    if (char_code < 0x20) {
        return; // Non-printable control code
    }

    uint16_t glyph_idx = char_code - 0x20;
    DP_GLYPH_INDEX = glyph_idx;

    // Calculate tile buffer base addresses in Bank $7F
    uint16_t tile_x = DP_CURSOR_X >> 3;
    uint16_t tile_y = DP_CURSOR_Y >> 3;

    uint16_t col0_base = WRAM_BUFFER_BASE + (tile_y * WRAM_LINE_STRIDE) + (tile_x * 16);
    uint16_t col1_base = col0_base + 16; // Adjacent right tile column

    DP_TILE_COL0_ADDR = col0_base;
    DP_TILE_COL1_ADDR = col1_base;

    // Sub-pixel shift amount (0..7 pixels)
    uint8_t sub_x = DP_CURSOR_X & 0x07;
    DP_SUBPIXEL_SHIFT = sub_x;

    // Height in rows to rasterize
    uint16_t row_count = WRAM_GLYPH_HEIGHT;
    DP_ROW_COUNTER = row_count;

    uint8_t* vram_staging = (uint8_t*)0x7FA000;
    const uint8_t* glyph_src = &g_font_glyph_bitmaps[glyph_idx * row_count];

    for (uint16_t r = 0; r < row_count; r++) {
        uint8_t raw_byte = glyph_src[r];

        // Shift 8-bit glyph into 16-bit space matching sub-pixel horizontal offset
        uint16_t shifted = ((uint16_t)raw_byte << 8) >> sub_x;
        DP_PLANE0_WORD = shifted;
        DP_PLANE1_WORD = shifted >> 1; // Drop shadow offset

        // Blit 2bpp row (2 bytes per row in SNES format)
        uint16_t row_byte_offset = r * 2;
        blit_shifted_glyph_row(
            vram_staging,
            col0_base + row_byte_offset,
            col1_base + row_byte_offset,
            DP_PLANE0_WORD,
            DP_PLANE1_WORD,
            DP_COLOR_MASK
        );
    }

    // Commit rendered glyph tiles into VRAM
    dialogue_glyph_stream_vram(char_code);
}
