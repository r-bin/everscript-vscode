/*
 * Routine: $8C:DE77 (opcode 0x5F)
 * Source: docs/disassembly/script-vm/opcode-5f-add-object-state.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_eval_expression(void);
extern uint16_t script_fetch_u16(void);
extern uint16_t map_object_target_state(uint16_t object_index);
extern void map_object_set_state(uint16_t object_index, uint16_t requested_state);

bool script_op_5f_add_object_state(void) {
    uint16_t object_index = script_eval_expression();
    uint16_t increment = script_fetch_u16();
    uint16_t current_target = map_object_target_state(object_index);
    uint16_t requested_state = (uint16_t)(current_target + increment);
    map_object_set_state(object_index, requested_state);
    return true;
}