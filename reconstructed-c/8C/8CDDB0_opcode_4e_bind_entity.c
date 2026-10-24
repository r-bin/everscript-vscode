/*
 * Routine: $8C:DDB0 (script_op_4e_bind_entity)
 * Source: docs/disassembly/script-vm/opcode-4e-bind-entity.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_eval_entity_address(void);
extern uint16_t script_current_slot_address(void);
extern uint16_t bus_read_word(uint32_t address);
extern void bus_write_word(uint32_t address, uint16_t value);

bool script_op_4e_bind_entity(void) {
    uint16_t new_entity = script_eval_entity_address();
    uint16_t slot = script_current_slot_address();
    uint16_t old_entity = bus_read_word(0x7E000Du + slot);

    if (old_entity != 0) {
        uint32_t reference_address = 0x7E0000u + old_entity + 0x3Eu;
        uint16_t references = bus_read_word(reference_address);
        bus_write_word(reference_address, (uint16_t)(references - 1u));
    }

    if (new_entity != 0) {
        uint32_t reference_address = 0x7E0000u + new_entity + 0x3Eu;
        uint16_t references = bus_read_word(reference_address);
        bus_write_word(reference_address, (uint16_t)(references + 1u));
    }

    bus_write_word(0x7E000Du + slot, new_entity);
    return true;
}