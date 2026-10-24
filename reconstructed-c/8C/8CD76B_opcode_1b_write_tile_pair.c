/*
 * Routine: $8C:D76B (script_op_1b_write_tile_pair)
 * Source: docs/disassembly/script-vm/opcode-1b-write-tile-pair.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_fetch_u16(void);
extern uint8_t script_fetch_u8(void);
extern void bus_write_word(uint32_t address, uint16_t value);

bool script_op_1b_write_tile_pair(void) {
    uint16_t x_offset = script_fetch_u16();
    uint16_t y_offset = script_fetch_u16();
    uint16_t x_pixels = (uint16_t)script_fetch_u8() << 3;
    uint16_t y_pixels = (uint16_t)script_fetch_u8() << 3;

    bus_write_word(0x2258UL + x_offset, x_pixels);
    bus_write_word(0x2258UL + y_offset, y_pixels);
    return true;
}