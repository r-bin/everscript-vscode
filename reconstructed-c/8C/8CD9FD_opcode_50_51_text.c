/*
 * Routines: $8C:D9FD (opcode 0x50), $8C:DA0A (opcode 0x51)
 * Source: docs/disassembly/script-vm/opcode-50-51-text.md
 */

#include <stdbool.h>
#include <stdint.h>

typedef struct {
    uint8_t bytes[0x2C];
} TextWindowRecord;

extern uint8_t script_fetch_u8(void);
extern uint16_t script_fetch_u16(void);
extern TextWindowRecord *text_window_record_from_index(uint8_t index);
extern TextWindowRecord *text_default_window_record(void);
extern void dialogue_unpack_string_key(uint16_t string_key);
extern void dialogue_render_string(TextWindowRecord *window);

static void render_script_text(TextWindowRecord *window) {
    uint16_t string_key = script_fetch_u16();
    dialogue_unpack_string_key(string_key);
    dialogue_render_string(window);
}

bool script_op_50_text_in_window(void) {
    uint8_t window_index = script_fetch_u8();
    TextWindowRecord *window = text_window_record_from_index(window_index);
    render_script_text(window);
    return true;
}

bool script_op_51_text(void) {
    render_script_text(text_default_window_record());
    return true;
}