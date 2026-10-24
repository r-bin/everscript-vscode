/*
 * Routine: $8C:D5AA (opcode 0x7E)
 * Source: docs/disassembly/script-vm/opcode-7e-currency-convert.md
 */

#include <stdint.h>

typedef enum {
    SCRIPT_HANDLER_CARRY_SET,
    SCRIPT_HANDLER_UNMODELED_DIVISOR_ZERO
} ScriptHandlerResult;

extern uint16_t script_eval_expression(void); /* $8C:EA43 */
extern uint16_t wram_read_word(uint16_t address);
extern uint8_t wram_read_byte(uint16_t address);
extern void wram_write_word(uint16_t address, uint16_t value);
extern void wram_write_byte(uint16_t address, uint8_t value);

static uint32_t read_currency(uint16_t offset) {
    uint16_t address = (uint16_t)(0x0AC6 + offset);
    uint32_t amount = wram_read_word(address);
    amount |= (uint32_t)wram_read_byte((uint16_t)(address + 2)) << 16;
    return amount;
}

static void write_currency(uint16_t offset, uint32_t amount) {
    uint16_t address = (uint16_t)(0x0AC6 + offset);
    amount &= 0x00FFFFFF;
    wram_write_word(address, (uint16_t)amount);
    wram_write_byte((uint16_t)(address + 2), (uint8_t)(amount >> 16));
}

ScriptHandlerResult script_op_7e_currency_convert(void) {
    uint8_t divisor = (uint8_t)script_eval_expression();
    uint16_t source_offset = script_eval_expression();
    uint8_t multiplier = (uint8_t)script_eval_expression();
    uint32_t source_amount = read_currency(source_offset);

    if (divisor == 0) {
        return SCRIPT_HANDLER_UNMODELED_DIVISOR_ZERO;
    }

    uint32_t scaled_amount = source_amount * multiplier;
    uint32_t quotient = scaled_amount / divisor;
    uint32_t remainder = scaled_amount % divisor;
    write_currency(source_offset, remainder);

    uint16_t destination_offset = script_eval_expression();
    uint32_t destination_amount = read_currency(destination_offset);
    write_currency(destination_offset, destination_amount + quotient);

    return SCRIPT_HANDLER_CARRY_SET;
}