# Dialogue Choice Box Frame Blitter & Joypad Branch Cursor Loop

**Addresses**:
- `window_box_frame_render`: `$8C:B647` – `$8C:B6C4`
- `dialogue_choice_joypad_cursor_loop`: `$8C:B81D` – `$8C:B98D`
- `dialogue_choice_character_append`: `$8C:B9A7` – `$8C:B9D5`

**ROM Source**: Bank `$8C` (US 1.0)  
**Subsystem**: UI / Dialogue Box & Name Entry Engine

---

## 1. Overview & Architectural Role

When Secret of Evermore prompts the player with in-game narrative decisions (e.g. answering "Yes" / "No" to NPCs, selecting alchemy formula targets, or entering character names during the opening intro), the UI subsystem switches to an interactive modal choice loop.

Key mechanisms:
1. **9-Slice Window Box Blitter (`window_box_frame_render`)**:
   Renders arbitrary rectangular window frames into shadow tilemap RAM (`$7F:C800`) using 8 border tile primitives (`0x0BF0`..`0x0BF7`). The routine leverages the SNES PPU hardware multiplier registers (`$4202`/`$4216`) to compute row strides ($Y \times 32$ tiles) in a single hardware cycle.
2. **Typematic Joypad Input Filter (`dialogue_choice_joypad_cursor_loop`)**:
   Configures fast UI auto-repeat timings (`$7E:0347 = 15` frames initial delay, `$7E:0349 = 5` frames sustained rate). Evaluates D-pad directions, updates cursor coordinates, ticks cursor sprite animation loops, and plays standardized audio feedback cues:
   - D-Pad navigation: Cursor tick SFX `0x0003`.
   - B Button / Selection: Option select SFX `0x0040`.
   - Start Button / Confirmation: Menu chime SFX `0x0012`.
3. **Character Name Entry & String Append (`dialogue_choice_character_append`)**:
   Converts ASCII keys into internal 1-byte character table codes, appends glyphs to the player's name buffer (`$7E:0387`), and clamps to maximum allowable length.

---

## 2. Data Structures & Memory Layout

```c
// Window Box Layout Input Parameters (Direct Page):
// DP $02: Column X origin (in 8x8 tile units, 0..31)
// DP $04: Row Y origin (in 8x8 tile units, 0..27)
// DP $06: Frame width (in tile units, min 2)
// DP $08: Frame height (in tile units, min 2)
// DP $12: Current row tilemap address in $7F:C800

// Choice Window Descriptor Structure ($7E:0380..$7E:03BF):
typedef struct ChoiceBoxContext {
    uint16_t window_x;       // +$00: Tile column
    uint16_t window_y;       // +$02: Tile row
    uint16_t window_w;       // +$04: Tile width
    uint16_t window_h;       // +$06: Tile height
    uint16_t buffer_base;    // +$0A: Output string buffer base pointer
    uint16_t text_length;    // +$0E: Current text length
    uint16_t max_length;     // +$10: Max text capacity
    uint16_t cursor_stride;  // +$2E: Vertical column jump stride
    uint16_t total_options;  // +$30: Total selectable choices
    uint16_t selected_index; // +$36: Currently highlighted option
} ChoiceBoxContext;

// Border Tile Constants:
#define TILE_FRAME_TOP_LEFT     0x0BF0
#define TILE_FRAME_TOP_EDGE     0x0BF1
#define TILE_FRAME_TOP_RIGHT    0x0BF2
#define TILE_FRAME_LEFT_EDGE    0x0BF3
#define TILE_FRAME_RIGHT_EDGE   0x0BF4
#define TILE_FRAME_BOTTOM_LEFT  0x0BF5
#define TILE_FRAME_BOTTOM_EDGE  0x0BF6
#define TILE_FRAME_BOTTOM_RIGHT 0x0BF7
```

---

## 3. Clean C Decompilation

```c
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
```
