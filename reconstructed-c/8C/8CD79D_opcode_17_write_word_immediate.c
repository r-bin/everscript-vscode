/*
 * Routine: $8C:D79D (script_op_17_write_word_immediate)
 * Source: docs/disassembly/script-vm/opcode-17-write-word-immediate.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_fetch_u16(void);
extern void bus_write_word(uint32_t address, uint16_t value);

bool script_op_17_write_word_immediate(void) {
    uint16_t offset = script_fetch_u16();
    uint16_t value = script_fetch_u16();

    bus_write_word(0x2258UL + offset, value);
    return true;
}