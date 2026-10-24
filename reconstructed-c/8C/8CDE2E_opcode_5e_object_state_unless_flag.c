/*
 * Routine: $8C:DE2E (opcode 0x5E)
 * Source: docs/disassembly/script-vm/opcode-5e-object-state-unless-flag.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_eval_expression(void);
extern uint16_t script_fetch_u16(void);
extern uint16_t save_flag_mask(uint16_t flag_id);
extern void map_object_set_state(uint16_t object_index, uint16_t requested_state);

bool script_op_5e_object_state_unless_flag(void) {
    uint16_t object_index = script_eval_expression();
    uint16_t flag_id = script_fetch_u16();
    uint16_t mask = save_flag_mask(flag_id);
    uint16_t requested_state = (mask != 0) ? mask : 0x007F;
    map_object_set_state(object_index, requested_state);
    return true;
}