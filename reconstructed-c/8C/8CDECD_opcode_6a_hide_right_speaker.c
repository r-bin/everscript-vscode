/*
 * Routine: $8C:DECD (opcode 0x6A)
 * Source: docs/disassembly/script-vm/opcode-6a-hide-right-speaker.md
 */

#include <stdbool.h>
#include <stdint.h>

extern void dialogue_speaker_hide(uint16_t slot);

bool script_op_6a_hide_right_speaker(void) {
    dialogue_speaker_hide(2);
    return true;
}