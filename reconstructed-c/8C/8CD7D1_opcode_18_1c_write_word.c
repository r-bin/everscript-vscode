/*
 * Routine: $8C:D7D1 (script_op_18_1c_write_word)
 * Source: docs/disassembly/script-vm/opcode-18-1c-write-word.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_fetch_u16(void);
extern uint16_t script_eval_expression(void); /* $8C:EA43 */
extern void bus_write_word(uint32_t address, uint16_t value);

bool script_op_18_1c_write_word(void) {
    uint16_t offset = script_fetch_u16();
    uint16_t value = script_eval_expression();

    bus_write_word(0x2258UL + offset, value);
    return true;
}