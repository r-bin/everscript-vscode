/*
 * Routine: $8C:D6A7 (script_op_30_32_play_sound)
 * Source: docs/disassembly/script-vm/opcode-30-32-play-sound.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint8_t script_fetch_u8(void);
extern uint16_t bus_read_word(uint32_t address);
extern uint16_t rom_read_word(uint32_t address);
extern void apu_command_send_sync(uint16_t command_id, uint16_t param_word);
extern void sfx_play_dispatch(uint16_t sfx_id);
extern void wram_write_word(uint16_t address, uint16_t value);

bool script_op_30_32_play_sound(void) {
    uint16_t sound_request = bus_read_word(0x7E243B);
    apu_command_send_sync(0x0030, sound_request);
    wram_write_word(0x243B, 0);

    uint8_t sound_id = script_fetch_u8();
    int16_t translated_sound =
        (int16_t)rom_read_word(0x8C8362u + sound_id);

    if (translated_sound >= 0) {
        sfx_play_dispatch((uint16_t)translated_sound);
    }

    return true;
}