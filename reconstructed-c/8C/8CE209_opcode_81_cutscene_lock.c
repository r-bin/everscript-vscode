/*
 * Routine: $8C:E209 (script opcode 0x81)
 * Source: docs/disassembly/script-vm/opcode-81-cutscene-lock.md
 */

#include <stdbool.h>

extern void call_cutscene_pause_guard(void); /* $8C:C543 */

bool script_op_81_cutscene_lock(void) {
    call_cutscene_pause_guard();
    return true;
}