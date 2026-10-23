/*
 * Routine: $8CA800 (dialogue_typewriter)
 * Bank: $8C (ROM Offset: $0CA800)
 * Source: docs/disassembly/ui/dialogue-typewriter.md
 */

#include <stdint.h>
#include <stdbool.h>

#define ASCII_SPACE_CODE                0x0020
#define DEFAULT_SPACE_WIDTH             4
#define SFX_DIALOGUE_CLICK              0x0003

#define JOYPAD_ACTION_BUTTONS           0x0A00  /* A or B buttons */
#define DIALOGUE_FLAG_FAST_FORWARD      0x0002

/** Dialogue window context. */
typedef struct {
    uint8_t  cursor_row;                /* $48: Current text line/row */
    uint8_t  cursor_col;                /* $46: Current text column */
    uint16_t control_flags;             /* $0621: Control and fast-forward flags */
    uint16_t char_code;                 /* Active character code */
    uint16_t char_width;                /* $08: Proportional character width in pixels */
    bool     typing_active;             /* $061F: Active typing sentinel */

    /* Font data pointers */
    const uint8_t *font_table_base;     /* $C4:0000 */
} DialogueWindowContext;

/** Forward declarations of engine subsystems. */
void engine_frame_tick(void);           /* $8E:E41E */
void play_sound_effect_direct(uint16_t sfx_id); /* $8C:82DC */
void dialogue_render_char_glyph(uint16_t char_code, uint8_t col, uint8_t row); /* $8C:A5A2 */
void dialogue_vram_commit_tile(uint16_t vram_offset); /* $8C:A7EC */

/**
 * @brief Subroutine $8C:A928: Decodes a character code and queries proportional glyph width.
 *
 * @param ctx Pointer to dialogue window context.
 * @param char_code The character code to evaluate.
 * @return uint16_t Proportional character width in pixels.
 */
uint16_t dialogue_glyph_decode_and_width_lookup(DialogueWindowContext *ctx, uint16_t char_code)
{
    /* 1. Space character handling */
    if (char_code == ASCII_SPACE_CODE) {
        ctx->char_width = DEFAULT_SPACE_WIDTH;
        return DEFAULT_SPACE_WIDTH;
    }

    /* 2. Relative index from space */
    uint16_t rel_idx = char_code - ASCII_SPACE_CODE;

    /* 3. Query glyph descriptor from Bank $C4 */
    uint8_t raw_width = ctx->font_table_base[rel_idx];
    ctx->char_width = (uint16_t)(raw_width + 1);

    return ctx->char_width;
}

/**
 * @brief Subroutine $8C:A853: Computes VRAM tilemap offset using hardware multiplier.
 *
 * @param ctx Pointer to dialogue window context.
 * @param row Screen row/line index.
 * @return uint16_t Target VRAM tile offset.
 */
uint16_t dialogue_glyph_commit_vram_pos(DialogueWindowContext *ctx, uint8_t row)
{
    /* Decode character width and setup bitplanes */
    dialogue_glyph_decode_and_width_lookup(ctx, ctx->char_code);

    /* Hardware multiplier $4202: (row | 0x0400) * 4 + 4 */
    uint16_t mult_a = (uint16_t)(row | 0x0400);
    uint16_t mult_product = mult_a * 4;
    uint16_t vram_target = 4 + mult_product;

    return vram_target;
}

/**
 * @brief Routine $8C:A800: Renders the next character, runs the interactive frame loop,
 *        and polls joypad for confirmation or fast-forward.
 *
 * @param ctx Pointer to dialogue window context.
 * @param joypad_state Current controller 1 button bitmask.
 * @return bool True if typewriter should continue; False if text block completed.
 */
bool dialogue_typewriter_step_and_poll_joypad(DialogueWindowContext *ctx, uint16_t joypad_state)
{
    /* 1. Render glyph into 2bpp staging buffer */
    dialogue_render_char_glyph(ctx->char_code, ctx->cursor_col, ctx->cursor_row);

    /* 2. Interactive wait loop with per-frame engine tick */
    while (true) {
        engine_frame_tick();

        /* Poll joypad edge transition */
        if (joypad_state & JOYPAD_ACTION_BUTTONS) {
            /* Play dialogue typewriter click sound effect */
            play_sound_effect_direct(SFX_DIALOGUE_CLICK);

            /* Check fast-forward mode */
            if (ctx->control_flags & DIALOGUE_FLAG_FAST_FORWARD) {
                ctx->typing_active = false;
                return false; /* Text complete */
            }

            break;
        }
    }

    /* 3. Calculate destination VRAM position and commit */
    uint16_t vram_offset = dialogue_glyph_commit_vram_pos(ctx, ctx->cursor_row);
    dialogue_vram_commit_tile(vram_offset);

    /* Advance cursor column by proportional width */
    ctx->cursor_col += (uint8_t)ctx->char_width;
    return true;
}
