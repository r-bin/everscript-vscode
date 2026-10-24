/*
 * Routine: $8C:E410 (script opcode 0x94)
 * Source: docs/disassembly/script-vm/opcode-94-heal-with-effect.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_eval_entity_expression(void); /* $8C:EC8E, result DP $4C */
extern uint16_t script_eval_expression(void); /* $8C:EA43 */
extern void apply_hp_healing_with_effect(uint16_t entity, uint16_t amount); /* $8F:C09A */

bool script_op_94_heal_with_effect(void) {
    uint16_t entity = script_eval_entity_expression();
    uint16_t amount = script_eval_expression();

    apply_hp_healing_with_effect(entity, amount);
    return true;
}