/*
 * Routine: $8C:D71F (script opcode 0xAE)
 * Shared tile-pair writer: $8C:D781
 * Source: docs/disassembly/script-vm/opcode-ae-write-arg-tile-pair.md
 */

#include <stdbool.h>
#include <stdint.h>

extern void wram_write_word(uint16_t address, uint16_t value);

bool script_op_ae_write_arg_tile_pair(uint16_t argument_base,
                                      const uint8_t **script_pc) {
    uint16_t x_address = (uint16_t)(argument_base + 0x000F + *(*script_pc)++);
    uint16_t y_address = (uint16_t)(argument_base + 0x000F + *(*script_pc)++);
    uint16_t x_tiles = *(*script_pc)++;
    uint16_t y_tiles = *(*script_pc)++;

    wram_write_word(x_address, (uint16_t)(x_tiles << 3));
    wram_write_word(y_address, (uint16_t)(y_tiles << 3));
    return true;
}