/*
 * Routine: $8C:DD41 (script opcode 0x9C)
 * Source: docs/disassembly/script-vm/opcode-9c-release-entity.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_eval_entity_expression(void); /* $8C:EC8E */
extern uint16_t wram_read_word(uint16_t address);
extern void wram_write_word(uint16_t address, uint16_t value);

bool script_op_9c_release_entity(void) {
    uint16_t entity = script_eval_entity_expression();
    uint16_t reference_count_address = (uint16_t)(entity + 0x003E);
    uint16_t reference_count = wram_read_word(reference_count_address);

    wram_write_word(reference_count_address, (uint16_t)(reference_count - 1));
    return true;
}