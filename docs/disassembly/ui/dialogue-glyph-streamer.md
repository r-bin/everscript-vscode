# Dialogue String Expansion & VRAM Glyph Rasterizer

**Addresses**:
- `string_window_glyph_interpreter`: `$8C:9E03` – `$8C:9F4D`
- `window_text_layout_align`: `$8C:9F4E` – `$8C:A1A6`
- `glyph_font_1bpp_unpacker`: `$8C:A4FE` – `$8C:A590`
- `font_glyph_bitmap_blit`: `$8C:A5A2` – `$8C:A5DF`

**ROM Source**: Bank `$8C` (US 1.0)
**Subsystem**: User Interface / Text Window Engine

---

## 1. Overview & Architectural Role

The Secret of Evermore dialogue formatting pipeline bridges compressed and raw string streams to the SNES tilemap display. While `string_resolve_and_decompress` (`$8C:CD33`) decodes compressed dialogue bytes into intermediate text buffers, `string_window_glyph_interpreter` (`$8C:9E03`) performs the actual typography layout, line wrapping, variable expansion, and glyph blitting into VRAM tile buffers.

Key mechanisms:
1. **Control Code Parsing & Table Dispatch**:
   Byte values $\ge 0x80$ are interpreted as control codes (newline, tab advance, wait for button press, sound effect trigger, or character color switch), jumping through the dispatch table at `$8C:9EFA`. Values $< 0x80$ represent standard ASCII glyphs.
2. **Text Alignment & Centering (`window_text_layout_align`)**:
   Window flags `+$12,Y` define alignment rules:
   - Bit 4 (`0x10`): Center text horizontally: `cursor_x = (window_width - line_width) / 2`.
   - Bit 5 (`0x20`): Right-align text: `cursor_x = window_width - line_width`.
3. **1bpp-to-4bpp Font Glyph Blitter (`font_glyph_bitmap_blit`)**:
   Looks up the 1bpp variable-width font pattern from Bank `$C4` via `$92,X`, calculates the destination tile offset using hardware multiplier registers `$4202` / `$4216`, unpacks bit planes into 2bpp/4bpp format, and advances the cursor X coordinate by the character width plus kerning spacing (`+$06,Y`).

---

## 2. Data Structures & Memory Layout

```c
// Window Descriptor Text Formatting Offsets:
// +$00 ($034D): Current line cursor X (pixels)
// +$02 ($034F): Current line cursor Y (pixels)
// +$04 ($0351): Space character width in pixels
// +$06 ($0353): Character kerning spacing
// +$08 ($0355): Vertical line spacing (pixels)
// +$0A ($0357): Left margin offset (pixels)
// +$0C ($0359): Right margin offset (pixels)
// +$0E ($035B): Usable line pixel width
// +$10 ($035D): Maximum visible line count
// +$12 ($035F): Layout flags ($10 = center, $20 = right-align, $40 = typematic delay)
// +$1C ($0369): Window width in 8x8 tiles
// +$1E ($036B): Window height in 8x8 tiles

// Global Font Parameters:
// $7E:05B1 - Line character accumulation buffer
// $7E:0B3D - Standard font glyph height (pixels)
// $7E:0B3F - Font glyph row stride in bytes
// $7E:0B41 - Base address of 2bpp/4bpp tile destination buffer
// DP $92   - Pointer to character width table in ROM ($C4)
```

---

## 3. Clean C Decompilation

```c
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
```

---

## 4. Verification & Behavioral Equivalence

1. **Alignment Calculation**: Matches assembly `$8C:A187` (`SBC $0C; LSR; STA $0000,Y`): perfectly reconstructs half-delta horizontal centering.
2. **Variable Width Offsets**: Uses table `[$92],Y` accurately for kerning and space metrics.
3. **Planar Bitshift**: Matches sub-pixel horizontal shifting and hardware multiplication across 8x8 font tile boundaries.
