/*
 * Routine: $8C9E03 (string_digraphs)
 * Bank: $8C (ROM Offset: $0C9E03)
 * Source: docs/disassembly/ui/string-digraphs.md
 */

#include <stdint.h>
#include <stdbool.h>
#include <string.h>

/* Special Control Tokens */
#define TOKEN_BOY_NAME        0x81
#define TOKEN_DOG_NAME        0x82
#define TOKEN_PLAYER_3        0x83
#define TOKEN_PLAYER_4        0x84
#define TOKEN_VARIABLE_A      0x8A
#define TOKEN_VARIABLE_B      0x8B

/* Static fallback strings */
static const char STRING_PLAYER_3[] = "player 3";
static const char STRING_PLAYER_4[] = "player 4";

/* Window formatting descriptor */
typedef struct {
    uint16_t cursor_x;
    uint16_t cursor_y;
    uint16_t space_width;
    uint16_t kerning_pad;
    uint16_t max_line_width;
    uint16_t text_style_flags;
} WindowLayoutDescriptor;

/* External font and layout routines */
extern WindowLayoutDescriptor *dialogue_get_layout_descriptor(uint16_t window_id);
extern uint8_t dialogue_get_glyph_width(uint8_t ascii_char);
extern uint16_t dialogue_calculate_tab_stop(uint16_t current_x);
extern const char *get_boy_name_buffer(void);
extern const char *get_dog_name_buffer(void);
extern void dialogue_blit_line_to_vram(const char *line_start, uint16_t char_count);

/**
 * Measures line width, resolves dynamic tokens, and splits string
 * into word-wrapped lines for dialogue window display.
 *
 * Address: $8C:9E03 - $8C:A0C4
 *
 * @param window_id Window buffer offset (e.g. 0x034D or 0x0379)
 * @param text_ptr  24-bit pointer to source text string
 */
void dialogue_format_and_append_line(uint16_t window_id, const char *text_ptr) {
    if (text_ptr == NULL) {
        return;
    }

    WindowLayoutDescriptor *layout = dialogue_get_layout_descriptor(window_id);
    if (!layout) {
        return;
    }

    const char *current_stream = text_ptr;
    const char *line_start = text_ptr;
    uint16_t line_accum_width = 0;
    uint16_t current_word_width = 0;
    const char *last_word_break = NULL;
    uint16_t line_char_count = 0;

    while (*current_stream != '\0') {
        uint8_t ch = (uint8_t)(*current_stream++);

        /* 1. Control Tokens (>= 0x80) */
        if (ch >= 0x80) {
            const char *expanded_token = NULL;
            switch (ch) {
                case TOKEN_BOY_NAME:
                    expanded_token = get_boy_name_buffer();
                    break;
                case TOKEN_DOG_NAME:
                    expanded_token = get_dog_name_buffer();
                    break;
                case TOKEN_PLAYER_3:
                    expanded_token = STRING_PLAYER_3;
                    break;
                case TOKEN_PLAYER_4:
                    expanded_token = STRING_PLAYER_4;
                    break;
                default:
                    break;
            }

            if (expanded_token != NULL) {
                /* Recursively measure or splice token contents */
                while (*expanded_token != '\0') {
                    uint8_t tok_ch = (uint8_t)(*expanded_token++);
                    uint8_t w = dialogue_get_glyph_width(tok_ch);
                    current_word_width += w + layout->kerning_pad;
                }
            }
            continue;
        }

        /* 2. Whitespace and Control Characters (< 0x80) */
        if (ch == '\n') {
            /* Forced newline: commit line and reset */
            line_accum_width += current_word_width;
            dialogue_blit_line_to_vram(line_start, line_char_count);
            line_start = current_stream;
            line_accum_width = 0;
            current_word_width = 0;
            last_word_break = NULL;
            line_char_count = 0;
            continue;
        }

        if (ch == ' ') {
            /* Space: commit word width and save break point */
            line_accum_width += current_word_width + layout->space_width + layout->kerning_pad;
            current_word_width = 0;
            last_word_break = current_stream;
            line_char_count++;
            continue;
        }

        if (ch == '\t') {
            /* Tab: advance to column boundary */
            line_accum_width += current_word_width;
            line_accum_width = dialogue_calculate_tab_stop(line_accum_width);
            current_word_width = 0;
            last_word_break = current_stream;
            line_char_count++;
            continue;
        }

        /* 3. Printable Proportional Glyph */
        if (ch >= 0x20) {
            uint8_t glyph_width = dialogue_get_glyph_width(ch);
            current_word_width += glyph_width + layout->kerning_pad;
            line_char_count++;

            /* Check Word-Wrap Limit */
            if ((line_accum_width + current_word_width) > layout->max_line_width) {
                if (last_word_break != NULL) {
                    /* Wrap line at previous space break */
                    dialogue_blit_line_to_vram(line_start, (uint16_t)(last_word_break - line_start));
                    line_start = last_word_break;
                    line_accum_width = current_word_width;
                    current_word_width = 0;
                    last_word_break = NULL;
                } else {
                    /* Hard character break if word exceeds entire line width */
                    dialogue_blit_line_to_vram(line_start, line_char_count - 1);
                    line_start = current_stream - 1;
                    line_accum_width = current_word_width;
                    current_word_width = 0;
                }
            }
        }
    }

    /* Finalize remaining text in buffer */
    if (line_char_count > 0 || current_word_width > 0) {
        dialogue_blit_line_to_vram(line_start, line_char_count);
    }
}
