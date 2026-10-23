/*
 * Routine: $8CB647 (dialogue_choice_box)
 * Bank: $8C (ROM Offset: $0CB647)
 * Source: docs/disassembly/ui/dialogue-choice-box.md
 */

#include <stdint.h>
#include <stdbool.h>

extern uint16_t g_shadow_tilemap[32 * 32]; // $7F:C800
extern uint16_t g_joypad_buttons;          // $7E:0104
extern uint16_t g_typematic_initial_delay; // $7E:0347
extern uint16_t g_typematic_repeat_rate;   // $7E:0349

extern void sfx_play_dispatch(uint16_t sfx_id); // $8C:82DC
extern uint16_t joypad_button_typematic_repeat(uint16_t mask); // $80:8838
extern void wait_for_frame(void); // $80:858C
extern void oam_commit_buffer(void); // $80:8FEE

// Lookup character map table in Bank $8C ($8C:B5F2)
extern const char g_alphabet_matrix[72]; // "A..Z", "0..9", "a..z", special punctuation

/**
 * Renders a 9-slice rectangular dialogue / choice frame into shadow tilemap RAM.
 *
 * @param origin_x Column origin in 8x8 tiles (0..31)
 * @param origin_y Row origin in 8x8 tiles (0..27)
 * @param width    Width in tiles
 * @param height   Height in tiles
 */
void window_box_frame_render(uint16_t origin_x, uint16_t origin_y, uint16_t width, uint16_t height) {
    if (width < 2 || height < 2) return;

    // Row stride is 32 tiles (64 bytes)
    uint16_t row_offset = (origin_y * 32 + origin_x);

    // 1. Top Border
    g_shadow_tilemap[row_offset] = TILE_FRAME_TOP_LEFT;
    for (uint16_t x = 1; x < width - 1; ++x) {
        g_shadow_tilemap[row_offset + x] = TILE_FRAME_TOP_EDGE;
    }
    g_shadow_tilemap[row_offset + width - 1] = TILE_FRAME_TOP_RIGHT;

    // 2. Interior Vertical Borders
    for (uint16_t y = 1; y < height - 1; ++y) {
        uint16_t inner_offset = ((origin_y + y) * 32 + origin_x);
        g_shadow_tilemap[inner_offset] = TILE_FRAME_LEFT_EDGE;
        g_shadow_tilemap[inner_offset + width - 1] = TILE_FRAME_RIGHT_EDGE;
    }

    // 3. Bottom Border
    uint16_t bottom_offset = ((origin_y + height - 1) * 32 + origin_x);
    g_shadow_tilemap[bottom_offset] = TILE_FRAME_BOTTOM_LEFT;
    for (uint16_t x = 1; x < width - 1; ++x) {
        g_shadow_tilemap[bottom_offset + x] = TILE_FRAME_BOTTOM_EDGE;
    }
    g_shadow_tilemap[bottom_offset + width - 1] = TILE_FRAME_BOTTOM_RIGHT;
}

/**
 * Appends a single selected character glyph to the active text buffer.
 */
void dialogue_choice_character_append(ChoiceBoxContext* ctx, char character) {
    if (!ctx || ctx->text_length >= ctx->max_length) return;

    uint8_t* buffer = (uint8_t*)ctx->buffer_base;
    buffer[ctx->text_length++] = (uint8_t)character;
}

/**
 * Interactive joypad choice selector loop.
 *
 * @param ctx Pointer to choice box configuration context
 * @return Selected option index upon confirmation
 */
uint16_t dialogue_choice_joypad_cursor_loop(ChoiceBoxContext* ctx) {
    // Arm typematic auto-repeat parameters for crisp UI navigation
    g_typematic_initial_delay = 15; // 0.25 seconds
    g_typematic_repeat_rate   = 5;  // 12 repeats/sec

    while (true) {
        // Synchronize display frame and flush OAM sprite positions
        oam_commit_buffer();
        wait_for_frame();

        // Query filtered typematic joypad input (ignoring unhandled buttons)
        uint16_t input = joypad_button_typematic_repeat(g_joypad_buttons & 0xDF00);
        if (!input) continue;

        // D-Pad Left: Decrement selected option
        if (input & 0x0200) {
            sfx_play_dispatch(0x0003); // Cursor move tick
            if (ctx->selected_index == 0) {
                ctx->selected_index = ctx->total_options - 1;
            } else {
                ctx->selected_index--;
            }
        }

        // D-Pad Right: Increment selected option
        if (input & 0x0100) {
            sfx_play_dispatch(0x0003);
            ctx->selected_index++;
            if (ctx->selected_index >= ctx->total_options) {
                ctx->selected_index = 0;
            }
        }

        // D-Pad Up: Move up by column stride
        if (input & 0x0800) {
            sfx_play_dispatch(0x0003);
            if (ctx->selected_index >= ctx->cursor_stride) {
                ctx->selected_index -= ctx->cursor_stride;
            } else {
                ctx->selected_index = (ctx->selected_index + ctx->total_options) - ctx->cursor_stride;
            }
        }

        // D-Pad Down: Move down by column stride
        if (input & 0x0400) {
            sfx_play_dispatch(0x0003);
            ctx->selected_index += ctx->cursor_stride;
            if (ctx->selected_index >= ctx->total_options) {
                ctx->selected_index %= ctx->cursor_stride;
            }
        }

        // B Button (Confirm Selection)
        if (input & 0x8000) {
            char selected_char = g_alphabet_matrix[ctx->selected_index];

            // 0x7E = Enter / Done
            if (selected_char == 0x7E) {
                sfx_play_dispatch(0x0012); // Menu confirm chime
                break;
            }

            // 0x7F = Backspace
            if (selected_char == 0x7F) {
                if (ctx->text_length > 0) {
                    ctx->text_length--;
                    sfx_play_dispatch(0x0040);
                }
                continue;
            }

            // Standard character append
            sfx_play_dispatch(0x0040);
            dialogue_choice_character_append(ctx, selected_char);
        }

        // Start Button (Quick Confirm)
        if (input & 0x1000) {
            sfx_play_dispatch(0x0012);
            break;
        }
    }

    // Wait 2 frames for audio and UI stabilization
    wait_for_frame();
    wait_for_frame();

    return ctx->selected_index;
}
