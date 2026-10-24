/*
 * Routine: $8C:D7B3 (script_op_1a_1e_write_arg_word)
 * Source: docs/disassembly/script-vm/opcode-1a-1e-write-arg-word.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint8_t script_fetch_u8(void);
extern uint16_t script_eval_expression(void); /* $8C:EA43 */
extern void script_write_db_word(uint16_t address, uint16_t value);

bool script_op_1a_1e_write_arg_word(uint16_t thread_slot_base) {
    uint8_t byte_offset = script_fetch_u8();
    uint16_t value = script_eval_expression();
    uint16_t destination = (uint16_t)(thread_slot_base + 0x000Fu + byte_offset);

    script_write_db_word(destination, value);
    return true;
}