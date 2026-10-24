/*
 * Routine: $8C:DA8D (opcode 0x73)
 * Source: docs/disassembly/script-vm/opcode-73-walk-to-direct.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_eval_entity_expression(void);
extern uint16_t script_eval_expression(void);
extern uint16_t wram_read_word(uint16_t address);
extern void walk_entity_direct_to_point(uint16_t entity, uint16_t x, uint16_t y);

bool script_op_73_walk_to_direct(void) {
    uint16_t entity = script_eval_entity_expression();
    uint16_t x = script_eval_expression();
    uint16_t y = script_eval_expression();

    if (entity < 0x4E89 && wram_read_word((uint16_t)(entity + 0x002A)) == 0) {
        return true;
    }

    walk_entity_direct_to_point(entity, x, y);
    return true;
}