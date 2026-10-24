/*
 * Routine: $8C:E405 (script opcode 0x23)
 * Source: docs/disassembly/script-vm/opcode-23-write-0e6e.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_fetch_u16(void); /* [$82], then INC $82 twice */
extern void wram_write_word(uint16_t address, uint16_t value);

bool script_op_23_write_0e6e(void) {
    uint16_t value = script_fetch_u16();
    wram_write_word(0x0E6E, value);
    return true;
}