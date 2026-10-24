/*
 * Routine: $8C:DE95 (opcode 0x5B)
 * Source: docs/disassembly/script-vm/opcode-5b-wait-dialogue.md
 */

#include <stdbool.h>

extern void dialogue_wait_until_ready_and_advance(void);

bool script_op_5b_wait_dialogue(void) {
    dialogue_wait_until_ready_and_advance();
    return true;
}