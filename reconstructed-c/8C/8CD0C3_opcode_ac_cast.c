/*
 * Routine: $8C:D0C3 (script opcode 0xAC)
 * Shared cast path: $8C:D0D3
 * Source: docs/disassembly/script-vm/opcode-ac-cast-skip-dead-dog.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t wram_read_word(uint16_t address);
extern bool script_cast_all_with_target_marker(uint16_t target_marker);

bool script_op_ac_cast(void) {
    uint16_t dog_hp = wram_read_word(0x4F61);
    uint16_t target_marker = dog_hp == 0 ? 0x4F37 : 0;
    return script_cast_all_with_target_marker(target_marker);
}