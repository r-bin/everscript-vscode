/*
 * Routine: $8C:D7FF (script_op_11_15_write_temp_byte)
 * Source: docs/disassembly/script-vm/opcode-11-15-write-temp-byte.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_fetch_u16(void); /* [$82], then INC $82 twice */
extern uint16_t script_eval_expression(void); /* $8C:EA43 */
extern void script_write_db_byte(uint16_t address, uint8_t value);

bool script_op_11_15_write_temp_byte(void) {
    uint16_t destination = (uint16_t)(0x2834u + script_fetch_u16());
    uint16_t value = script_eval_expression();

    script_write_db_byte(destination, (uint8_t)value);
    return true;
}