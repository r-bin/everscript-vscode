/*
 * Routine: $8C:E357 (script opcode 0x8A)
 * Source: docs/disassembly/script-vm/opcode-8a-open-shop.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_eval_expression(void); /* $8C:EA43 */
extern void wram_write_word(uint16_t address, uint16_t value);
extern uint16_t wram_read_word(uint16_t address);
extern uint16_t rom_read_word_long(uint32_t address);
extern void dp_write_word(uint16_t address, uint16_t value);
extern void enter_data_bank_80_preserving_current_bank(void);
extern void restore_preserved_data_bank(void);
extern void rom_call_8e9fa8(void);

bool script_op_8a_open_shop(void) {
    wram_write_word(0x05A7, script_eval_expression());
    dp_write_word(0x0098, 0x8E99);

    uint16_t item_kinds = wram_read_word(0x0E6C);
    uint16_t mode = rom_read_word_long(0x8CE37BUL + item_kinds);
    if (mode != 0) {
        dp_write_word(0x0097, mode);

        enter_data_bank_80_preserving_current_bank();
        rom_call_8e9fa8();
        restore_preserved_data_bank();
    }

    return true;
}