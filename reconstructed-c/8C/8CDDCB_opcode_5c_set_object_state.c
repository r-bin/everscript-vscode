/*
 * Routine: $8C:DDCB (opcode 0x5C)
 * Source: docs/disassembly/script-vm/opcode-5c-set-object-state.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_eval_expression(void);
extern void map_object_set_state(uint16_t object_index, uint16_t requested_state);

bool script_op_5c_set_object_state(void) {
    uint16_t object_index = script_eval_expression();
    uint16_t requested_state = script_eval_expression();
    map_object_set_state(object_index, requested_state);
    return true;
}