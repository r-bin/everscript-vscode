/*
 * Routine: $8C:D87C (script_op_4c_skip_byte)
 * Source: docs/disassembly/script-vm/opcode-4c-skip-byte.md
 */

#include <stdbool.h>
#include <stdint.h>

bool script_op_4c_skip_byte(uint16_t *script_pc_low) {
    *script_pc_low = (uint16_t)(*script_pc_low + 1u);
    return true;
}