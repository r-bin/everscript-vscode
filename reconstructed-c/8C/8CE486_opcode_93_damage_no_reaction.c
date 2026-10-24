/*
 * Routine: $8C:E486 (script opcode 0x93)
 * Source: docs/disassembly/script-vm/opcode-93-damage-no-reaction.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t wram_read_word(uint16_t address);
extern uint16_t script_eval_entity_expression(void); /* $8C:EC8E, result DP $4C */
extern uint16_t script_eval_expression(void); /* $8C:EA43 */
extern void queue_script_damage_without_reaction(uint16_t entity, uint16_t amount); /* $8F:C132 */

bool script_op_93_damage_no_reaction(void) {
    uint16_t entity = script_eval_entity_expression();
    uint16_t amount = script_eval_expression();
    uint16_t hp = wram_read_word((uint16_t)(entity + 0x002A));

    if (hp != 0) {
        queue_script_damage_without_reaction(entity, amount);
    }

    return true;
}