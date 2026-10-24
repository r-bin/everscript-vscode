/*
 * Routine: $8C:E203 (script opcode 0x80)
 * Source: docs/disassembly/script-vm/opcode-80-dialogue-next.md
 */

#include <stdbool.h>

extern void call_dialogue_queue_advance(void); /* $8C:C55D */

bool script_op_80_dialogue_next(void) {
    call_dialogue_queue_advance();
    return true;
}