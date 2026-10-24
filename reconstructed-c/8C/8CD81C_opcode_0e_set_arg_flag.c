/*
 * Routine: $8C:D81C (script_op_0e_set_arg_flag)
 * Source: docs/disassembly/script-vm/opcode-0e-set-arg-flag.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint8_t script_fetch_u8(void);
extern uint16_t script_eval_expression(void); /* $8C:EA43 */

bool script_op_0e_set_arg_flag(uint8_t *argument_bytes) {
    uint8_t bit_index = script_fetch_u8();
    uint16_t value = script_eval_expression();
    uint8_t mask = (uint8_t)(1u << (bit_index & 0x07u));
    uint8_t *flag_byte = &argument_bytes[bit_index >> 3];

    if (value != 0) {
        *flag_byte |= mask;
    } else {
        *flag_byte &= (uint8_t)~mask;
    }

    return true;
}