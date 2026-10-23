/*
 * Routine: $8C8236 (soundbank_streamer)
 * Bank: $8C (ROM Offset: $0C8236)
 * Source: docs/disassembly/audio/soundbank-streamer.md
 */

#include <stdint.h>
#include <stdbool.h>

extern uint16_t g_current_soundbank; // $0E4B
extern uint16_t g_pending_track;     // $0E4D
extern uint16_t g_pending_sfx;       // $0E4F

extern void apu_command_send_sync(uint16_t cmd, uint16_t param); // $8C:81FD
extern void spc700_ipl_bootloader_handshake_block(const uint8_t* block_src); // $8C:805B
extern void apu_wait_ready_timeout(void); // $8C:81D4

/**
 * $8C:8236 - spc_soundbank_load_and_ipl_stream
 * Checks if soundbank is cached; if not, streams new BRR sample block to SPC700 via IPL.
 */
void spc_soundbank_load_and_ipl_stream(uint8_t soundbank_id) {
    // If soundbank is already resident in SPC700 RAM, return immediately
    if (soundbank_id == 0 || (uint8_t)g_current_soundbank == soundbank_id) {
        return;
    }

    g_current_soundbank = soundbank_id;

    // Index 3-byte descriptor from master table at $81:9903
    uint16_t entry_offset = (uint16_t)soundbank_id * 3;
    uint16_t block_low  = *(const uint16_t*)(0x819903 + entry_offset);
    uint8_t  block_bank = *(const uint8_t*)(0x819905 + entry_offset);
    const uint8_t* block_far_ptr = (const uint8_t*)(((uint32_t)block_bank << 16) | block_low);

    // Send APU command 0x000E: Prepare for IPL sample upload
    apu_command_send_sync(0x000E, soundbank_id);

    // Execute synchronous byte streaming loop across ports $2140/$2141
    spc700_ipl_bootloader_handshake_block(block_far_ptr);
    apu_wait_ready_timeout();

    // Send APU command 0x0002: Acknowledge upload completion and resume DSP
    apu_command_send_sync(0x0002, 0);
    apu_wait_ready_timeout();
}

/**
 * $8C:828F - music_play_song_with_soundbank
 * Resolves soundbank from song header, streams samples if needed, and starts music playback.
 */
void music_play_song_with_soundbank(uint16_t track_id) {
    g_pending_track = track_id;

    // Reset volume and fade-out active track
    apu_command_send_sync(0x001C, 0x8080); // Command 0x1C: Master volume reset
    apu_command_send_sync(0x001A, 0x0000); // Command 0x1A: Fade-out to silence

    // Look up required soundbank from ROM table at $81:9900
    uint8_t track_count = *(const uint8_t*)(0x819900);
    uint16_t bank_table_offset = ((uint16_t)(track_count + 1) * 3) + 0x9903 + track_id;
    uint8_t required_bank_id = *(const uint8_t*)(0x810000 + bank_table_offset);

    // Stream soundbank samples to SPC700
    spc_soundbank_load_and_ipl_stream(required_bank_id);

    // Send APU command 0x0006: Start music track playback
    apu_command_send_sync(0x0006, g_pending_track);
}

/**
 * $8C:82E3 - sfx_play_with_bank_switch
 * Triggers sound effect that requires specialized sample soundbank swapping.
 */
void sfx_play_with_bank_switch(uint16_t sfx_id) {
    g_pending_sfx = sfx_id;

    // Look up required soundbank for this SFX
    uint8_t track_count = *(const uint8_t*)(0x819900);
    uint8_t sfx_count   = *(const uint8_t*)(0x819901);
    uint16_t sfx_bank_offset = ((uint16_t)(track_count + 1) * 3) + 0x9903 + sfx_count + sfx_id;
    uint8_t required_bank_id = *(const uint8_t*)(0x810000 + sfx_bank_offset);

    // Stream required soundbank
    spc_soundbank_load_and_ipl_stream(required_bank_id);

    // Send APU command 0x0004: Play sound effect
    apu_command_send_sync(0x0004, g_pending_sfx);
}
