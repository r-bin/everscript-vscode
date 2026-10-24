/*
 * Routine: $8C:E247 (script opcode 0x83)
 * Source: docs/disassembly/script-vm/opcode-83-apply-screen-layers.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint8_t wram_read_byte(uint16_t address);
extern void ppu_write_register(uint16_t address, uint8_t value);
extern void wram_write_byte(uint16_t address, uint8_t value);

bool script_op_83_apply_screen_layers(void) {
    ppu_write_register(0x212C, wram_read_byte(0x0F80));
    ppu_write_register(0x212D, wram_read_byte(0x0F81));
    ppu_write_register(0x2131, wram_read_byte(0x0F82));
    ppu_write_register(0x2130, wram_read_byte(0x0F83));

    uint8_t layer_flags = wram_read_byte(0x0B29);
    wram_write_byte(0x0B29, (uint8_t)(layer_flags & 0xFE));

    if ((wram_read_byte(0x22EA) & 0x80) != 0) {
        wram_write_byte(0x0B29, 0x01);
    }

    return true;
}