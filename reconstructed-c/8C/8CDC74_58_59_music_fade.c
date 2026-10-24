/*
 * Routines: $8C:DC74 (opcode 0x59), $8C:DC87 (opcode 0x58)
 * Source: docs/disassembly/script-vm/opcode-58-59-music-fade.md
 */

#include <stdbool.h>
#include <stdint.h>

extern void master_music_volume_fade_step(int8_t step);

bool script_op_58_music_fade_in(void) {
    master_music_volume_fade_step(0x10);
    return true;
}

bool script_op_59_music_fade_out(void) {
    master_music_volume_fade_step(-0x10);
    return true;
}