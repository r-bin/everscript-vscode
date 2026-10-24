/*
 * Routine: $8C:E2B5 (script opcode 0x89)
 * Source: docs/disassembly/script-vm/opcode-89-add-shop-item.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_eval_expression(void); /* $8C:EA43 */
extern uint8_t wram_read_byte(uint16_t address);
extern uint16_t wram_read_word(uint16_t address);
extern void wram_write_byte(uint16_t address, uint8_t value);
extern void wram_write_word(uint16_t address, uint16_t value);
extern uint8_t rom_read_byte_long(uint32_t address);

static bool compare_result_is_nonnegative(uint16_t value, uint16_t operand) {
    return (((uint16_t)(value - operand) & 0x8000) == 0);
}

bool script_op_89_add_shop_item(void) {
    uint16_t slot = 0xFFFF;
    do {
        slot++;
    } while ((wram_read_byte((uint16_t)(0x0B95 + slot)) & 0x80) == 0);

    uint16_t item = script_eval_expression();
    uint16_t item_category_flag;
    if (!compare_result_is_nonnegative(item, 0x0008)) {
        item_category_flag = 0x0002;
    } else if (!compare_result_is_nonnegative(item, 0x0030)) {
        item_category_flag = 0x0004;
    } else {
        item_category_flag = 0x0008;
    }

    wram_write_word(0x0E6C,
                    (uint16_t)(wram_read_word(0x0E6C) | item_category_flag));

    uint8_t item_id = rom_read_byte_long(0x8CE311UL + item);
    wram_write_byte((uint16_t)(0x0B95 + slot), item_id);
    wram_write_byte((uint16_t)(0x0B96 + slot), 0xFF);

    uint16_t price_offset = (uint16_t)(slot << 1);
    uint16_t price = script_eval_expression();
    wram_write_word((uint16_t)(0x0BC5 + price_offset), price);

    return true;
}