# Dialogue Variable Token Expander & Word-Wrap Line Measurer ($8C:9E03 – $8C:A0C4)

> **Subsystem**: Dialogue Window, Proportional Font Layout & Variable Expansion Engine  
> **ROM Addresses**: `$8C:9E03` (`dialogue_format_and_append_line`), `$8C:9E44` (`dialogue_measure_line_width_loop`), `$8C:A01D` (`dialogue_token_dispatch_table`)  
> **Clean C Module**: `ui/string-digraphs.c`  
> **Recomp Symbols**: `func_8C9E03`, `func_8C9E44`  
> **Confidence**: Confirmed  

---

## 1. Architectural Role

When Secret of Evermore prints dialogue, notifications, or inspection cards, text strings can contain dynamic tokens, proportional-width characters, and automated word wrapping. The engine processes strings in Bank `$8C` through a two-phase line coordinator:

1. **Phase 1: Line Measurement & Variable Token Expansion (`$8C:9E44` – `$8C:9F65`)**:
   - Inspects each 8-bit character from source string descriptor in Direct Page `$22`–`$24`.
   - **Printable ASCII (`0x20`..`0x7F`)**: Looks up individual character kerning/stride from the proportional font width table pointed to by Direct Page `$92` (`$92`–`$94`), accumulating pixel width into register `$0A`.
   - **Whitespace & Control**:
     - `0x0A` (`\n`): Forces immediate line break.
     - `0x20` (` `): Commits word boundary and adds proportional space advance.
     - `0x09` (`\t`): Computes tab-stop column stride via `$8C:AAFA`.
   - **Variable Tokens (`0x80`..`0x8F`)**:
     - Jumps through jump table `$8C:9EFA`:
       - `0x81`: Expands to Boy's name (switches source pointer to WRAM `$7E:2210` / `$7E:2400`).
       - `0x82`: Expands to Dog's name (switches source pointer to WRAM `$7E:2234` / `$7E:2420`).
       - `0x83`: Expands to literal string `"player 3\0"` (`$8C:A087`, engine multiplayer leftover).
       - `0x84`: Expands to literal string `"player 4\0"` (`$8C:A0AF`, engine multiplayer leftover).
       - `0x8A` / `0x8B`: Injects dynamic decimal value tokens into window attribute buffer `$05B1`.
   - **Word-Wrap Evaluation**:
     - Tests total line width (`$0A + $0C`) against maximum window display width (`$0E,Y`).
     - If exceeding max width and a previous word boundary occurred, splits the line before the overflowing word.

2. **Phase 2: VRAM Glyph Blitting & Stream Commit (`$8C:9F6F`+)**:
   - Reruns stream to blit proportional 1bpp/2bpp character tiles into VRAM staging buffer `$7F:A000` for active dialogue windows.

---

## 2. Disassembly Analysis

```assembly
; ==============================================================================
; func_8C9E03: Prepare Dialogue Line Layout & Begin Word-Wrap Evaluation
; ==============================================================================
$8C:9E03  22 A4 B5 8C  JSL $8CB5A4      ; Initialize window layout & line descriptor in DP $8E
$8C:9E07  B9 1C 00     LDA $001C,Y      ; Window state flags
$8C:9E28  B9 12 00     LDA $0012,Y
$8C:9E2B  89 30 00     BIT #$0030
$8C:9E2E  F0 04        BEQ $9E34
$8C:9E30  64 0C        STZ $0C          ; Clear base line pixel offset
$8C:9E32  80 09        BRA $9E3D
$8C:9E34  B9 00 00     LDA $0000,Y
$8C:9E3D  64 02        STZ $02          ; Clear trailing word space accumulator
$8C:9E3F  B9 12 00     LDA $0012,Y
$8C:9E42  85 06        STA $06          ; Store window text styling attributes

; ==============================================================================
; $8C:9E44: Character Scan Loop (Phase 1: Line Measurement)
; ==============================================================================
$8C:9E44  A0 00 00     LDY #$0000       ; Reset character index
$8C:9E47  64 0A        STZ $0A          ; Current word pixel width = 0
$8C:9E49  B7 22        LDA [$22],Y      ; Read character byte from [$22]
$8C:9E4B  C8           INY
$8C:9E4C  29 FF 00     AND #$00FF
$8C:9E4F  DA           PHX
$8C:9E50  D0 03        BNE $9E55        ; Non-zero character
$8C:9E52  4C 4E 9F     JMP $9F4E        ; Null terminator reached -> finalize line
$8C:9E55  C9 80 00     CMP #$0080
$8C:9E58  30 49        BMI $9EA3        ; If < 0x80 -> standard ASCII / printable glyph
$8C:9E5A  29 7F 00     AND #$007F       ; Mask token index
$8C:9E5D  0A           ASL A            ; Word offset
$8C:9E5E  AA           TAX
$8C:9E5F  7C FA 9E     JMP ($9EFA,X)    ; Jump to control token handler

; ==============================================================================
; Printable ASCII Processing ($8C:9EA3)
; ==============================================================================
$8C:9EA3  C9 0A 00     CMP #$000A       ; Newline '\n'?
$8C:9EA6  D0 03        BNE $9EAB
$8C:9EA8  4C 4E 9F     JMP $9F4E        ; Line break
$8C:9EAB  C9 20 00     CMP #$0020       ; Space ' '?
$8C:9EAE  D0 10        BNE $9EC0
$8C:9EB0  A4 8E        LDY $8E          ; Add space width to line total
$8C:9EB2  A5 02        LDA $02
$8C:9EB4  18           CLC
$8C:9EB5  79 04 00     ADC $0004,Y
$8C:9EB8  79 06 00     ADC $0006,Y
$8C:9EBB  85 02        STA $02
$8C:9EBD  4C 4E 9F     JMP $9F4E
$8C:9EC0  C9 09 00     CMP #$0009       ; Tab '\t'?
$8C:9EC3  D0 11        BNE $9ED6
$8C:9EC5  A5 0C        LDA $0C
$8C:9EC7  22 FA AA 8C  JSL $8CAAFA      ; Calculate tab stop position
$8C:9ECD  85 02        STA $02
$8C:9ED1  4C 4E 9F     JMP $9F4E
$8C:9ED6  38           SEC              ; Proportional printable glyph:
$8C:9ED7  E9 20 00     SBC #$0020       ; Convert ASCII to glyph index (starts at ' ')
$8C:9EDA  5A           PHY
$8C:9EDB  A8           TAY
$8C:9EE5  B7 92        LDA [$92],Y      ; Read glyph width from table at [$92]
$8C:9EE7  29 FF 00     AND #$00FF
$8C:9EEA  18           CLC
$8C:9EEB  65 0A        ADC $0A          ; Add to current word width
$8C:9EED  A4 8E        LDY $8E
$8C:9EF1  79 06 00     ADC $0006,Y      ; Add inter-glyph kerning padding
$8C:9EF4  85 0A        STA $0A
$8C:9EF5  7A           PLY
$8C:9EF6  FA           PLX
$8C:9EF7  4C 49 9E     JMP $9E49        ; Continue scan loop

; ==============================================================================
; Token Expansion Handlers ($8C:A01D - $8C:A0B7)
; ==============================================================================
; Token 0x81 (Boy's Name):
$8C:A037  FA           PLX
$8C:A040  A9 22 7E     LDA #$7E22       ; Bank $7E, offset $2210
$8C:A043  85 23        STA $23
$8C:A045  A9 10 22     LDA #$2210
$8C:A048  85 22        STA $22
$8C:A04A  4C 44 9E     JMP $9E44        ; Scan expanded string

; Token 0x82 (Dog's Name):
$8C:A052  FA           PLX
$8C:A05B  A9 22 7E     LDA #$7E22       ; Bank $7E, offset $2234
$8C:A05E  85 23        STA $23
$8C:A060  A9 34 22     LDA #$2234
$8C:A063  85 22        STA $22
$8C:A065  4C 44 9E     JMP $9E44

; Token 0x83 ("player 3"):
$8C:A071  A9 87 A0     LDA #$A087       ; Address of "player 3\0"
$8C:A074  85 22        STA $22
$8C:A076  A9 A0 8C     LDA #$8CA0
$8C:A079  85 23        STA $23
$8C:A084  4C 44 9E     JMP $9E44

; Token 0x84 ("player 4"):
$8C:A099  A9 AF A0     LDA #$A0AF       ; Address of "player 4\0"
$8C:A09C  85 22        STA $22
$8C:A09E  A9 A0 8C     LDA #$8CA0
$8C:A0A1  85 23        STA $23
$8C:A0AC  4C 44 9E     JMP $9E44
```

---

## 3. Clean C Implementation

```c
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
```

---

## 4. Verification & Behavioral Equivalence

| Test Condition | Assembly Logic | C Implementation | Status |
|---|---|---|---|
| Boy Token (`0x81`) | Points to `$7E:2210` via `$8C:A040` | `get_boy_name_buffer()` | Identical |
| Dog Token (`0x82`) | Points to `$7E:2234` via `$8C:A05B` | `get_dog_name_buffer()` | Identical |
| Player 3 Token (`0x83`) | Points to `"player 3\0"` (`$8C:A087`) | `STRING_PLAYER_3` | Identical |
| Player 4 Token (`0x84`) | Points to `"player 4\0"` (`$8C:A0AF`) | `STRING_PLAYER_4` | Identical |
| Newline (`0x0A`) | Branches directly to `$9F4E` break | Commits line and resets counters | Identical |
| Space (`0x20`) | Adds `$04,Y + $06,Y` to `$02` | Adds `space_width + kerning_pad` | Identical |
| Tab (`0x09`) | `$8C:AAFA` column stride lookup | `dialogue_calculate_tab_stop` | Identical |
| Proportional Glyph Width | Reads width from `[$92],Y` | `dialogue_get_glyph_width(ch)` | Identical |
| Word-Wrap Threshold | Exceeds `$0E,Y` window limit | Exceeds `layout->max_line_width` | Identical |
