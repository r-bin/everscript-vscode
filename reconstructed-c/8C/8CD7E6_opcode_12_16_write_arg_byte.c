/*
 * Routine: $8C:D7E6 (script_op_12_16_write_arg_byte)
 * Source: docs/disassembly/script-vm/opcode-12-16-write-arg-byte.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint8_t script_fetch_u8(void);
extern uint16_t script_eval_expression(void); /* $8C:EA43 */
extern void script_write_db_byte(uint16_t address, uint8_t value);

bool script_op_12_16_write_arg_byte(uint16_t thread_slot_base) {
    uint16_t destination = (uint16_t)(thread_slot_base + 0x000Fu + script_fetch_u8());
    uint16_t value = script_eval_expression();

    script_write_db_byte(destination, (uint8_t)value);
    return true;
}