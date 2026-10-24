/*
 * Routine: $8C:D532 (script opcode 0x85)
 * Source: docs/disassembly/script-vm/opcode-85-currency-take.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_eval_expression(void); /* $8C:EA43 */
extern uint16_t bus_read_word(uint32_t address);
extern uint8_t bus_read_byte(uint32_t address);
extern void bus_write_word(uint32_t address, uint16_t value);
extern void bus_write_byte(uint32_t address, uint8_t value);

bool script_op_85_currency_take(void) {
    uint16_t offset = script_eval_expression();
    uint16_t amount = script_eval_expression();
    uint32_t low_address = 0x000AC6UL + offset;
    uint32_t high_address = 0x000AC8UL + offset;

    uint16_t old_low = bus_read_word(low_address);
    uint16_t new_low = (uint16_t)(old_low - amount);
    bus_write_word(low_address, new_low);

    uint8_t borrow = old_low < amount ? 1 : 0;
    uint8_t old_high = bus_read_byte(high_address);
    bus_write_byte(high_address, (uint8_t)(old_high - borrow));

    return true;
}