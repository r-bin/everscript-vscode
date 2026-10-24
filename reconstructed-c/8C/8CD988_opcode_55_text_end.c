/*
 * Routine: $8C:D988 (opcode 0x55)
 * Source: docs/disassembly/script-vm/opcode-55-text-end.md
 */

#include <stdbool.h>
#include <stdint.h>

typedef struct {
    uint8_t bytes[0x2C];
} TextWindowRecord;

extern TextWindowRecord *text_default_window_record(void);
extern void dialogue_window_close(TextWindowRecord *window);
extern void dialogue_window_open_next(void);

bool script_op_55_text_end(void) {
    dialogue_window_close(text_default_window_record());
    dialogue_window_open_next();
    return true;
}