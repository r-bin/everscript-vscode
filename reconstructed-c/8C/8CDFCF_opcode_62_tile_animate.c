/*
 * Routine: $8C:DFCF (opcode 0x62)
 * Source: docs/disassembly/script-vm/opcode-62-tile-animate.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint8_t script_fetch_u8(void);
extern uint16_t script_fetch_u16(void);
extern void map_tile_animation_start(uint8_t channel_key, uint16_t parameter_a,
                                     uint16_t parameter_b);

bool script_op_62_tile_animate(void) {
    uint8_t channel_key = script_fetch_u8();
    uint16_t parameter_a = script_fetch_u16();
    uint16_t parameter_b = script_fetch_u16();
    map_tile_animation_start(channel_key, parameter_a, parameter_b);
    return true;
}