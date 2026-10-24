/*
 * Routine: $8C:DC10 (script_op_27_fade_out)
 * Source: docs/disassembly/script-vm/opcode-27-fade-out.md
 */

#include <stdbool.h>
#include <stdint.h>

extern void wram_write_word(uint16_t address, uint16_t value);

bool script_op_27_fade_out(void) {
    wram_write_word(0x0B83, 0x8000);
    return true;
}