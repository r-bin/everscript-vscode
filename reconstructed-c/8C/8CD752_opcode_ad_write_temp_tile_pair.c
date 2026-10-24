/*
 * Routine: $8C:D752 (script opcode 0xAD)
 * Shared tile-pair writer: $8C:D781
 * Source: docs/disassembly/script-vm/opcode-ad-write-temp-tile-pair.md
 */

#include <stdbool.h>
#include <stdint.h>

extern void wram_write_word(uint16_t address, uint16_t value);

static uint16_t read_u16_le(const uint8_t **script_pc) {
    uint16_t value = (*script_pc)[0] | ((uint16_t)(*script_pc)[1] << 8);
    *script_pc += 2;
    return value;
}

bool script_op_ad_write_temp_tile_pair(const uint8_t **script_pc) {
    uint16_t x_address = (uint16_t)(0x2834 + read_u16_le(script_pc));
    uint16_t y_address = (uint16_t)(0x2834 + read_u16_le(script_pc));
    uint16_t x_tiles = *(*script_pc)++;
    uint16_t y_tiles = *(*script_pc)++;

    wram_write_word(x_address, (uint16_t)(x_tiles << 3));
    wram_write_word(y_address, (uint16_t)(y_tiles << 3));
    return true;
}