/*
 * Routine: $8C:DEB4 (opcode 0x65)
 * Source: docs/disassembly/script-vm/opcode-65-reshow-left-speaker.md
 */

#include <stdbool.h>
#include <stdint.h>

extern volatile uint16_t wram_0b73;
extern void dialogue_speaker_show(uint16_t slot, uint16_t entity_id);

bool script_op_65_reshow_left_speaker(void) {
    dialogue_speaker_show(1, wram_0b73);
    return true;
}