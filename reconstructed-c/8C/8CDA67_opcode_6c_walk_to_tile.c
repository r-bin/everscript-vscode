/*
 * Routine: $8C:DA67 (opcode 0x6C)
 * Source: docs/disassembly/script-vm/opcode-6c-walk-to-tile.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_eval_entity_expression(void);
extern uint8_t script_fetch_u8(void);
extern uint16_t wram_read_word(uint16_t address);
extern void walk_entity_path_to_point(uint16_t entity, uint16_t x, uint16_t y);

bool script_op_6c_walk_to_tile(void) {
    uint16_t entity = script_eval_entity_expression();
    uint16_t x = (uint16_t)script_fetch_u8() << 3;
    uint16_t y = (uint16_t)script_fetch_u8() << 3;

    if (entity < 0x4E89 && wram_read_word((uint16_t)(entity + 0x002A)) == 0) {
        return true;
    }

    walk_entity_path_to_point(entity, x, y);
    return true;
}