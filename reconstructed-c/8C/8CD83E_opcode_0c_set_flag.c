/*
 * Routine: $8C:D83E (script_op_0c_set_flag)
 * Source: docs/disassembly/script-vm/opcode-0c-set-flag.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_fetch_u16(void);
extern uint16_t script_eval_expression(void); /* $8C:EA43 */
extern uint8_t bus_read_byte(uint32_t address);
extern void bus_write_byte(uint32_t address, uint8_t value);

bool script_op_0c_set_flag(void) {
    uint16_t bit_index = script_fetch_u16();
    uint16_t value = script_eval_expression();
    uint32_t flag_address = 0x2258UL + (bit_index >> 3);
    uint8_t mask = (uint8_t)(1u << (bit_index & 0x07u));
    uint8_t flag_byte = bus_read_byte(flag_address);

    if (value != 0) {
        flag_byte |= mask;
    } else {
        flag_byte &= (uint8_t)~mask;
    }

    bus_write_byte(flag_address, flag_byte);
    return true;
}