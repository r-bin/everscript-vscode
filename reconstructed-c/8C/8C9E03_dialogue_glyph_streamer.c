/*
 * Routine: $8C9E03 (dialogue_glyph_streamer)
 * Bank: $8C (ROM Offset: $0C9E03)
 * Source: docs/disassembly/ui/dialogue-glyph-streamer.md
 */

#include <stdint.h>
#include <stdbool.h>

extern WindowDescriptor g_active_window; // $034D
extern uint8_t  g_char_line_buffer[64];  // $05B1
extern uint16_t g_font_glyph_height;    // $0B3D
extern uint16_t g_font_row_stride;      // $0B3F
extern uint16_t g_font_buffer_base;     // $0B41
extern const uint8_t* g_char_width_table; // DP $92

extern void vram_queue_dma_transfer(uint16_t src, uint8_t bank, uint16_t vram_dest, uint16_t len);
extern uint16_t window_tab_next_stop(uint16_t cur_x); // $8C:AAFA

/**
 * $8C:9E03 - string_window_glyph_interpreter
 * Evaluates a string buffer and formats text lines into the window tilemap.
 */
void string_window_glyph_interpreter(WindowDescriptor* win, const uint8_t* str) {
    win->line_pixel_width = (win->width_tiles * 8) - (win->left_margin * 2);
    win->flags &= ~0x0080; // Clear line overflow flag

    uint16_t str_idx = 0;
    uint16_t line_len = 0;

    while (str[str_idx] != '\0') {
        uint8_t c = str[str_idx++];

        // Control code check (>= 0x80)
        if (c >= 0x80) {
            // Dispatch control code handler
            if (c == 0x8A) { // Newline control code
                break;
            }
            continue;
        }

        // Standard ASCII characters
        if (c == '\n') {
            break;
        } else if (c == ' ') {
            line_len += win->space_width + win->kerning;
        } else if (c == '\t') {
            line_len = window_tab_next_stop(line_len);
        } else if (c >= 0x20) {
            uint8_t glyph_idx = c - 0x20;
            line_len += g_char_width_table[glyph_idx] + win->kerning;
        }

        // Buffer glyph for rendering pass
        g_char_line_buffer[win->buffered_chars++] = c;
    }

    // Perform text alignment pass
    window_text_layout_align(win, line_len);
}

/**
 * $8C:9F4E - window_text_layout_align
 * Centers or right-aligns line based on window descriptor flags.
 */
void window_text_layout_align(WindowDescriptor* win, uint16_t line_width) {
    if (win->flags & 0x0010) {
        // Centered alignment: cursor_x = (usable_width - line_width) / 2
        int16_t rem = (int16_t)win->line_pixel_width - (int16_t)line_width;
        win->cursor_x = (rem > 0) ? (rem / 2) : win->left_margin;
    } else if (win->flags & 0x0020) {
        // Right alignment: cursor_x = usable_width - line_width
        int16_t rem = (int16_t)win->line_pixel_width - (int16_t)line_width;
        win->cursor_x = (rem > 0) ? rem : win->left_margin;
    } else {
        // Left alignment
        win->cursor_x = win->left_margin;
    }

    // Render each buffered character
    for (uint16_t i = 0; i < win->buffered_chars; i++) {
        uint8_t c = g_char_line_buffer[i];
        glyph_font_1bpp_unpacker(win, c);
    }
}

/**
 * $8C:A4FE - glyph_font_1bpp_unpacker
 * Advances text coordinates and invokes font rasterizer for glyph c.
 */
void glyph_font_1bpp_unpacker(WindowDescriptor* win, uint8_t c) {
    if (c == '\n') {
        win->cursor_x = win->left_margin;
        win->cursor_y += g_font_glyph_height + win->line_spacing;
        return;
    }
    if (c == '\t') {
        win->cursor_x = window_tab_next_stop(win->cursor_x);
        return;
    }
    if (c == ' ') {
        win->cursor_x += win->space_width;
        return;
    }

    if (c >= 0x20) {
        uint8_t glyph_idx = c - 0x20;
        uint8_t width = g_char_width_table[glyph_idx];

        // Check if character exceeds right margin
        uint16_t max_x = (win->width_tiles * 8) - win->right_margin;
        if (win->cursor_x + width > max_x) {
            // Soft line wrap
            win->cursor_x = win->left_margin;
            win->cursor_y += g_font_glyph_height + win->line_spacing;
        }

        // Blit glyph bitmap
        font_glyph_bitmap_blit(win, glyph_idx);
        win->cursor_x += width + win->kerning;
    }
}

/**
 * $8C:A5A2 - font_glyph_bitmap_blit
 * Unpacks 1bpp font tile bitmap into destination tile buffer in WRAM/VRAM.
 */
void font_glyph_bitmap_blit(WindowDescriptor* win, uint8_t glyph_idx) {
    // ROM font pattern offset from $C4:0000
    const uint8_t* font_src = (const uint8_t*)(0xC40000 + (glyph_idx * 16));

    // Target buffer tile coordinates
    uint16_t tile_col = win->cursor_x >> 3;
    uint16_t tile_row = win->cursor_y >> 3;
    uint16_t sub_pixel_x = win->cursor_x & 0x07;

    // Hardware multiply: dest_offset = base + (tile_row * row_stride) + (tile_col * 32)
    uint16_t dest_offset = g_font_buffer_base + (tile_row * g_font_row_stride) + (tile_col * 32);

    // Unpack 1bpp slices into 2bpp/4bpp planar format
    uint16_t* dest_buf = (uint16_t*)(0x7F0000 + dest_offset);
    for (uint16_t line = 0; line < 8; line++) {
        uint8_t slice = font_src[line];
        // Shift glyph by sub_pixel_x
        uint16_t shifted_slice = (uint16_t)slice >> sub_pixel_x;
        dest_buf[line] |= shifted_slice;
    }
}
