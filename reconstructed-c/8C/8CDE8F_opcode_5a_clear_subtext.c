/*
 * Routine: $8C:DE8F (opcode 0x5A)
 * Source: docs/disassembly/script-vm/opcode-5a-clear-subtext.md
 */

#include <stdbool.h>

extern void dialogue_subtitle_clear_and_wait(void);

bool script_op_5a_clear_subtext(void) {
    dialogue_subtitle_clear_and_wait();
    return true;
}