/*
 * Routine: $8C:DD33 (script opcode 0x9B)
 * Source: docs/disassembly/script-vm/opcode-9b-destroy.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_eval_entity_expression(void); /* $8C:EC8E */
extern uint16_t wram_read_word(uint16_t address);
extern void wram_write_word(uint16_t address, uint16_t value);
extern void release_entity_and_attached_resources(uint16_t entity); /* $8F:B2DE */

bool script_op_9b_destroy(void) {
    uint16_t entity = script_eval_entity_expression();
    uint16_t reference_count_address = (uint16_t)(entity + 0x003E);
    uint16_t reference_count = wram_read_word(reference_count_address);

    wram_write_word(reference_count_address, (uint16_t)(reference_count - 1));
    release_entity_and_attached_resources(entity);
    return true;
}