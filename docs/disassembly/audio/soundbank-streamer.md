# Dynamic Sound Bank Streaming & SPC700 IPL Bootloader Handshake

**Addresses**:
- `spc_soundbank_load_and_ipl_stream`: `$8C:8236` – `$8C:828E`
- `music_play_song_with_soundbank`: `$8C:828F` – `$8C:82DB`
- `sfx_play_with_bank_switch`: `$8C:82E3` – `$8C:8327`

**ROM Source**: Bank `$8C` (US 1.0)
**Subsystem**: Audio Subsystem / SPC700 Sample Streamer

---

## 1. Overview & Architectural Role

The Secret of Evermore audio architecture dynamically reloads BRR (Bit Rate Reduction) instrument sample banks into SPC700 RAM when switching between environmental background tracks or casting complex spells that require unique sound effects.

Key mechanisms:
1. **Cache Verification (`spc_soundbank_load_and_ipl_stream`)**:
   Before initiating an expensive transfer, the engine compares the requested soundbank identifier against `$7E:0E4B`. If the soundbank is already resident in SPC700 RAM, the function returns immediately.
2. **Master Audio Header Indexing (`$81:9900`)**:
   Song track and sound effect records in ROM point to master entries in Bank `$81`. Each entry provides a 3-byte descriptor (`$81:9903,X` low word, `$81:9905,X` bank byte) pointing directly to the compressed BRR sample block.
3. **IPL Handshake & Upload Protocol**:
   - Sends APU command `0x000E` to prime the SPC700 IPL bootloader.
   - Invokes `spc700_ipl_bootloader_handshake_block` (`$8C:805B`) to stream sample bytes across ports `$2140`–`$2141`.
   - Waits for acknowledgment with timeout loop `$8C:81D4`.
   - Sends confirmation command `0x0002` to finalize the transfer and resume the audio engine.
   - Sends command `0x0006` with the track ID in port `$2140` to begin playback.

---

## 2. Data Structures & Memory Layout

```c
// Audio Engine WRAM Variables:
// $7E:0E4B - Currently loaded soundbank ID
// $7E:0E4D - Pending music track ID
// $7E:0E4F - Pending sound effect ID
// DP $A0..$A2 - 24-bit far pointer to soundbank metadata in Bank $81
// REG_APUIO0..3 - Hardware ports $2140..$2143

// ROM Master Audio Header ($81:9900):
// +$00: Track count
// +$01: Sound effect count
// +$03..: Array of 3-byte far pointers to sample blocks (16-bit offset + 8-bit bank)
```

---

## 3. Clean C Decompilation

```c
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
```

---

## 4. Verification & Behavioral Equivalence

1. **Cache Verification**: Matches assembly `$8C:8241` (`CMP $0E4B; BEQ $828E`), preventing redundant sample uploads.
2. **Master Table Arithmetic**: Reconstructs formula `(count + 1) * 3 + 0x9903` from `$8C:82AF`–`$8C:82B7`.
3. **APU Command Protocol**: Uses APU command `0x000E` (upload start), `0x0002` (upload finalize), and `0x0006` (play track) with sequence handshakes.
