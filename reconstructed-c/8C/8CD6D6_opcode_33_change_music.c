/*
 * Routine: $8C:D6D6 (script_op_33_change_music)
 * Source: docs/disassembly/script-vm/opcode-33-change-music.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint8_t script_fetch_u8(void);
extern uint16_t rom_read_word(uint32_t address);
extern uint8_t bus_read_byte(uint32_t address);
extern void apu_command_send_sync(uint16_t command_id, uint16_t param_word);
extern void bus_write_byte(uint32_t address, uint8_t value);
extern void play_music_track(uint16_t song_id);

bool script_op_33_change_music(void) {
    uint8_t music_id = script_fetch_u8();

    apu_command_send_sync(0x001A, 0);

    bus_write_byte(0x004200, 0);
    apu_command_send_sync(0x002A, 0x00A0);
    apu_command_send_sync(0x002C, 0);

    int16_t translated_song =
        (int16_t)rom_read_word(0x8C8442u + music_id);
    if (translated_song >= 0) {
        play_music_track((uint16_t)translated_song);
    }

    uint8_t interrupt_control = bus_read_byte(0x7E0E6B);
    bus_write_byte(0x004200, interrupt_control);
    return true;
}