/*
 * Routine: $8C:DA88 (script opcode 0x9D)
 * Source: docs/disassembly/script-vm/opcode-9d-walk-to.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_eval_entity_expression(void); /* $8C:EC8E, result DP $4C */
extern uint16_t script_eval_expression(void); /* $8C:EA43 */
extern uint16_t wram_read_word(uint16_t address);
extern void walk_entity_path_to_point(uint16_t entity, uint16_t x, uint16_t y); /* $8F:AA82 */

bool script_op_9d_walk_to(void) {
    uint16_t entity = script_eval_entity_expression();
    uint16_t x = script_eval_expression();
    uint16_t y = script_eval_expression();

    if (entity < 0x4E89 && wram_read_word((uint16_t)(entity + 0x002A)) == 0) {
        return true;
    }

    walk_entity_path_to_point(entity, x, y);
    return true;
}