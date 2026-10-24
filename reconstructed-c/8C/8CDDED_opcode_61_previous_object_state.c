/*
 * Routine: $8C:DDED (opcode 0x61)
 * Source: docs/disassembly/script-vm/opcode-61-previous-object-state.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_eval_expression(void);
extern uint16_t map_object_target_state(uint16_t object_index);
extern void map_object_set_state(uint16_t object_index, uint16_t requested_state);

bool script_op_61_previous_object_state(void) {
    uint16_t object_index = script_eval_expression();
    uint16_t current_target = map_object_target_state(object_index);
    uint16_t requested_state = (uint16_t)((current_target & 0x00FF) - 1);
    map_object_set_state(object_index, requested_state);
    return true;
}