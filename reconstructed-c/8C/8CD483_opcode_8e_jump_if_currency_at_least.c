/*
 * Routine: $8C:D483 (script opcode 0x8E)
 * Source: docs/disassembly/script-vm/opcode-8e-jump-if-currency-at-least.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_eval_expression(void); /* $8C:EA43 */
extern uint16_t bus_read_word(uint32_t address);
extern uint8_t bus_read_byte(uint32_t address);
extern uint16_t script_fetch_u16(void);
extern void script_vm_jump_relative_16(void); /* $8C:D434 */

bool script_op_8e_jump_if_currency_at_least(void) {
    uint16_t offset = script_eval_expression();
    uint16_t amount = script_eval_expression();
    uint32_t low_address = 0x000AC6UL + offset;
    uint32_t high_address = 0x000AC8UL + offset;

    uint16_t balance_low = bus_read_word(low_address);
    uint8_t balance_high = bus_read_byte(high_address);
    bool enough = balance_high != 0 || balance_low >= amount;

    if (enough) {
        script_vm_jump_relative_16();
    } else {
        (void)script_fetch_u16();
    }

    return true;
}