/*
 * Routine: $8C:E7EF (script opcode 0xAA)
 * Source: docs/disassembly/script-vm/opcode-aa-cure.md
 */

#include <stdbool.h>
#include <stdint.h>

typedef enum {
    SCRIPT_CARRY_PRESERVED,
    SCRIPT_CARRY_SET
} ScriptCarryOutcome;

extern uint16_t wram_read_word(uint32_t address);
extern void clear_entity_status_effects(uint16_t entity, bool carry_in); /* $91:B9A7 */

ScriptCarryOutcome script_op_aa_cure(bool incoming_carry) {
    if (wram_read_word(0x7E23C7UL) != 0) {
        return incoming_carry ? SCRIPT_CARRY_SET : SCRIPT_CARRY_PRESERVED;
    }

    clear_entity_status_effects(0x4E89, true);
    clear_entity_status_effects(0x4F37, true);
    return SCRIPT_CARRY_SET;
}
