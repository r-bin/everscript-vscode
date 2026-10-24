/*
 * Routine: $8C:E08E
 * Source: docs/disassembly/script-vm/write-word-to-expression-address.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_eval_expression(void); /* $8C:EA43 */
extern void script_write_db_word(uint16_t address, uint16_t value);

bool write_word_to_expression_address(void) {
    uint16_t destination = script_eval_expression();
    uint16_t value = script_eval_expression();

    script_write_db_word(destination, value);
    return true;
}