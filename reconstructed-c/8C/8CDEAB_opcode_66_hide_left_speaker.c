/*
 * Routine: $8C:DEAB (opcode 0x66)
 * Source: docs/disassembly/script-vm/opcode-66-hide-left-speaker.md
 */

#include <stdbool.h>
#include <stdint.h>

extern void dialogue_speaker_hide(uint16_t slot);

bool script_op_66_hide_left_speaker(void) {
    dialogue_speaker_hide(1);
    return true;
}