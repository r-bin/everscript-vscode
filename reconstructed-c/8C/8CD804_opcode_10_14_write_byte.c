/*
 * Routine: $8C:D804 (script_op_10_14_write_byte)
 * Source: docs/disassembly/script-vm/opcode-10-14-write-byte.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_fetch_u16(void);
extern uint16_t script_eval_expression(void); /* $8C:EA43 */
extern void bus_write_byte(uint32_t address, uint8_t value);

bool script_op_10_14_write_byte(void) {
    uint16_t offset = script_fetch_u16();
    uint16_t value = script_eval_expression();

    bus_write_byte(0x2258UL + offset, (uint8_t)value);
    return true;
}