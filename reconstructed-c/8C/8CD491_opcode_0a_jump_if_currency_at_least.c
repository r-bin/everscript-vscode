/*
 * Routine: $8C:D491 (script_op_0a_jump_if_amount_at_least)
 * Source: docs/disassembly/script-vm/opcode-0a-jump-if-currency-at-least.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_eval_expression(void); /* $8C:EA43 */
extern uint16_t script_fetch_u16(void);
extern uint8_t script_fetch_u8(void);
extern uint16_t bus_read_word(uint32_t address);
extern uint8_t bus_read_byte(uint32_t address);
extern void script_vm_jump_relative_16(void); /* $8C:D434 */

bool script_op_0a_jump_if_currency_at_least(void) {
    uint16_t currency_offset = script_eval_expression();
    uint32_t threshold = script_fetch_u16();
    threshold |= (uint32_t)script_fetch_u8() << 16;
    uint32_t currency_address = 0x000AC6UL + currency_offset;
    uint32_t balance = bus_read_word(currency_address);
    balance |= (uint32_t)bus_read_byte(currency_address + 2u) << 16;

    if (balance >= threshold) {
        script_vm_jump_relative_16();
    } else {
        (void)script_fetch_u16();
    }

    return true;
}