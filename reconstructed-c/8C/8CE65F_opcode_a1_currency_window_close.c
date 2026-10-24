/*
 * Routine: $8C:E65F (script opcode 0xA1)
 * Source: docs/disassembly/script-vm/opcode-a1-currency-window-close.md
 */

#include <stdbool.h>
#include <stdint.h>

extern void clear_window_record(uint16_t record); /* $8C:ADE5 */
extern void wram_write_word(uint16_t address, uint16_t value);

bool script_op_a1_currency_window_close(void) {
    clear_window_record(0x0435);
    wram_write_word(0x0CB3, 0);
    return true;
}