/*
 * Routine: $8C:D557 (opcode 0x7C)
 * Source: docs/disassembly/script-vm/opcode-7c-currency-add.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_eval_expression(void); /* $8C:EA43 */
extern uint16_t script_fetch_u16(void);        /* [$82], advance by two */
extern uint8_t script_fetch_u8(void);          /* [$82], advance by one */
extern uint16_t wram_read_word(uint16_t address);
extern uint8_t wram_read_byte(uint16_t address);
extern void wram_write_word(uint16_t address, uint16_t value);
extern void wram_write_byte(uint16_t address, uint8_t value);

bool script_op_7c_currency_add(void) {
    uint16_t offset = script_eval_expression();
    uint16_t addend_low = script_fetch_u16();
    uint8_t addend_high = script_fetch_u8();
    uint16_t address = (uint16_t)(0x0AC6 + offset);

    uint32_t balance = wram_read_word(address);
    balance |= (uint32_t)wram_read_byte((uint16_t)(address + 2)) << 16;
    uint32_t addend = addend_low | ((uint32_t)addend_high << 16);
    uint32_t result = (balance + addend) & 0x00FFFFFF;

    wram_write_word(address, (uint16_t)result);
    wram_write_byte((uint16_t)(address + 2), (uint8_t)(result >> 16));
    return true;
}