/*
 * Routine: $8C:E420 (script opcode 0x95)
 * Source: docs/disassembly/script-vm/opcode-95-heal.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_eval_entity_expression(void); /* $8C:EC8E, result DP $4C */
extern uint16_t script_eval_expression(void); /* $8C:EA43 */
extern void apply_hp_healing(uint16_t entity, uint16_t amount); /* $8F:C0A5 */

bool script_op_95_heal(void) {
    uint16_t entity = script_eval_entity_expression();
    uint16_t amount = script_eval_expression();

    apply_hp_healing(entity, amount);
    return true;
}