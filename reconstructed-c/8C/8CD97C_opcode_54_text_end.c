/*
 * Routine: $8C:D97C (opcode 0x54)
 * Source: docs/disassembly/script-vm/opcode-54-text-end.md
 */

#include <stdbool.h>
#include <stdint.h>

typedef struct {
    uint8_t bytes[0x2C];
} TextWindowRecord;

extern uint8_t script_fetch_u8(void);
extern TextWindowRecord *text_window_record_from_index(uint8_t index);
extern void dialogue_window_close(TextWindowRecord *window);
extern void dialogue_window_open_next(void);

bool script_op_54_text_end_in_window(void) {
    uint8_t window_index = script_fetch_u8();
    TextWindowRecord *window = text_window_record_from_index(window_index);
    dialogue_window_close(window);
    dialogue_window_open_next();
    return true;
}