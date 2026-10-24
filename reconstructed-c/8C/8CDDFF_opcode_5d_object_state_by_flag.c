/*
 * Routine: $8C:DDFF (opcode 0x5D)
 * Source: docs/disassembly/script-vm/opcode-5d-object-state-by-flag.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_eval_expression(void);
extern uint16_t script_fetch_u16(void);
extern bool save_flag_is_set(uint16_t flag_id);
extern void map_object_set_state(uint16_t object_index, uint16_t requested_state);

bool script_op_5d_object_state_by_flag(void) {
    uint16_t object_index = script_eval_expression();
    uint16_t flag_id = script_fetch_u16();
    uint16_t requested_state = save_flag_is_set(flag_id) ? 0x007F : 0;
    map_object_set_state(object_index, requested_state);
    return true;
}