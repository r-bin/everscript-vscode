/*
 * Routine: $8C:DA28 (opcode 0x6F)
 * Source: docs/disassembly/script-vm/opcode-6f-walk-by-direct.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_eval_entity_expression(void);
extern uint16_t script_eval_expression(void);
extern uint16_t wram_read_word(uint16_t address);
extern void walk_entity_direct_to_point(uint16_t entity, uint16_t x, uint16_t y);

bool script_op_6f_walk_by_direct(void) {
    uint16_t entity = script_eval_entity_expression();
    uint16_t dx = (uint16_t)(script_eval_expression() << 4);
    uint16_t dy = (uint16_t)(script_eval_expression() << 4);
    uint16_t x = (uint16_t)(wram_read_word((uint16_t)(entity + 0x001A)) + dx);
    uint16_t y = (uint16_t)(wram_read_word((uint16_t)(entity + 0x001C)) + dy);

    if (entity < 0x4E89 && wram_read_word((uint16_t)(entity + 0x002A)) == 0) {
        return true;
    }

    walk_entity_direct_to_point(entity, x, y);
    return true;
}