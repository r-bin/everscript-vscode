/*
 * Routine: $8C:DED6 (opcode 0x69)
 * Source: docs/disassembly/script-vm/opcode-69-reshow-right-speaker.md
 */

#include <stdbool.h>
#include <stdint.h>

extern volatile uint16_t wram_0b75;
extern void dialogue_speaker_show(uint16_t slot, uint16_t entity_id);

bool script_op_69_reshow_right_speaker(void) {
    dialogue_speaker_show(2, wram_0b75);
    return true;
}