/*
 * Routine: $8C:E09D
 * Source: docs/disassembly/script-vm/write-byte-to-expression-address.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_eval_expression(void); /* $8C:EA43 */
extern void script_write_db_byte(uint16_t address, uint8_t value);

bool write_byte_to_expression_address(void) {
    uint16_t destination = script_eval_expression();
    uint16_t value = script_eval_expression();

    script_write_db_byte(destination, (uint8_t)value);
    return true;
}