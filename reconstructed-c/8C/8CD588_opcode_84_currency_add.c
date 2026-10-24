/*
 * Routine: $8C:D588 (script opcode 0x84)
 * Source: docs/disassembly/script-vm/opcode-84-currency-add.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_eval_expression(void); /* $8C:EA43 */
extern uint16_t cpu_read_direct_page_register(void);
extern uint16_t bus_read_word(uint32_t address);
extern uint8_t bus_read_byte(uint32_t address);
extern void bus_write_word(uint32_t address, uint16_t value);
extern void bus_write_byte(uint32_t address, uint8_t value);

bool script_op_84_currency_add(void) {
    uint16_t offset = script_eval_expression();
    uint16_t amount = script_eval_expression();
    uint32_t low_address = 0x000AC6UL + offset;
    uint32_t high_address = 0x000AC8UL + offset;

    uint32_t low_sum = (uint32_t)bus_read_word(low_address) + amount;
    bus_write_word(low_address, (uint16_t)low_sum);

    uint16_t high_sum = (uint16_t)bus_read_byte(high_address)
                      + (uint8_t)cpu_read_direct_page_register()
                      + (uint16_t)(low_sum >> 16);
    bus_write_byte(high_address, (uint8_t)high_sum);

    return true;
}