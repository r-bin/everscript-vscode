/*
 * Routine: $8C81FD (spc_handshake)
 * Bank: $8C (ROM Offset: $0C81FD)
 * Source: docs/disassembly/audio/spc-handshake.md
 */

#include <stdint.h>
#include <stdbool.h>

#define APU_TIMEOUT_CYCLES  10240

// Memory-Mapped SNES Hardware I/O Ports
typedef struct {
    volatile uint8_t port0; // 0x2140: Payload Low
    volatile uint8_t port1; // 0x2141: Payload High
    volatile uint8_t port2; // 0x2142: Command ID
    volatile uint8_t port3; // 0x2143: Sequence Tag Echo
} SnesApuPorts;

typedef struct {
    uint8_t  seq_counter;     // DP $9F: Active sequence tag
    uint16_t resident_bank;   // $7E:0E4B: Currently resident instrument soundbank
    uint16_t current_song;    // $7E:0E4D: Currently playing music track
    uint16_t transfer_depth;  // $7E:0E51: Transfer nesting depth
    uint16_t lock_flag;       // $7E:0E65: Queue mutex lock
} AudioSystemContext;

extern volatile SnesApuPorts g_apu_io;
extern AudioSystemContext    g_audio_ctx;
extern const uint8_t         g_rom[0x400000];

extern void spc700_upload_block(uint32_t rom_addr);

/**
 * Sends a command packet to the SPC700 sound processor with spinlock handshake.
 * Corresponds to $8C:81FD.
 */
void apu_send_command(uint8_t cmd, uint16_t payload) {
    g_audio_ctx.lock_flag = 0;
    g_audio_ctx.transfer_depth++;

    // Spin wait for APU to echo current sequence tag
    uint32_t timeout = APU_TIMEOUT_CYCLES;
    while (g_apu_io.port2 != g_audio_ctx.seq_counter) {
        if (--timeout == 0) {
            // Recover from desync: resync with APU's current state
            g_audio_ctx.seq_counter = g_apu_io.port2;
            break;
        }
    }

    // Advance sequence counter (1..255, skipping 0)
    g_audio_ctx.seq_counter++;
    if (g_audio_ctx.seq_counter == 0) {
        g_audio_ctx.seq_counter = 1;
    }

    // Atomic payload and command write
    g_apu_io.port0 = (uint8_t)(payload & 0xFF);
    g_apu_io.port1 = (uint8_t)(payload >> 8);
    g_apu_io.port2 = cmd;
    g_apu_io.port3 = g_audio_ctx.seq_counter;

    g_audio_ctx.transfer_depth--;
}

/**
 * Ensures the required instrument soundbank is resident in SPC700 RAM.
 * Corresponds to $8C:8236.
 */
void load_song_soundbank(uint8_t bank_id) {
    if (bank_id == 0 || bank_id == (g_audio_ctx.resident_bank & 0xFF)) {
        return; // Already resident
    }

    g_audio_ctx.resident_bank = bank_id;

    // Read 24-bit soundbank pointer from ROM table $81:9903
    uint32_t table_offset = 0x019903 + (uint32_t)bank_id * 3;
    uint32_t bank_addr = (uint32_t)g_rom[table_offset] |
                         ((uint32_t)g_rom[table_offset + 1] << 8) |
                         ((uint32_t)g_rom[table_offset + 2] << 16);

    // Command 0x0E: prepare APU for stream
    apu_send_command(0x0E, 0);

    // Upload soundbank samples to SPC700
    spc700_upload_block(bank_addr);

    // Command 0x02: finalize soundbank setup
    apu_send_command(0x02, 0);
}

/**
 * Sets up master volume, validates soundbank, and starts song playback.
 * Corresponds to $8C:828F.
 */
void play_music_track(uint16_t song_id) {
    g_audio_ctx.current_song = song_id;

    // Command 0x1C: Master Volume / Stereo Pan (0x8080 = balanced centered default)
    apu_send_command(0x1C, 0x8080);

    // Command 0x1A: Stop previous track
    apu_send_command(0x1A, 0x0000);

    // Look up required soundbank from ROM table $81:9900
    uint8_t bank_count = g_rom[0x019900];
    uint32_t meta_offset = 0x019903 + 3 * (bank_count + 1) + song_id;
    uint8_t required_bank = g_rom[meta_offset];

    load_song_soundbank(required_bank);

    // Command 0x06: Trigger track playback
    apu_send_command(0x06, song_id);
}
