/*
 * Routine: $8C:E2AA (script opcode 0x88)
 * Source: docs/disassembly/script-vm/opcode-88-clear-shop.md
 */

#include <stdbool.h>
#include <stdint.h>

extern void wram_write_word(uint16_t address, uint16_t value);

bool script_op_88_clear_shop(void) {
    wram_write_word(0x0B95, 0xFFFF);
    wram_write_word(0x0E6C, 0x0000);
    return true;
}