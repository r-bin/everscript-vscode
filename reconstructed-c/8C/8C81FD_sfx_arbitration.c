/*
 * Routine: $8C81FD (sfx_arbitration)
 * Bank: $8C (ROM Offset: $0C81FD)
 * Source: docs/disassembly/audio/sfx-arbitration.md
 */

#include <stdint.h>
#include <stdbool.h>
#include <stdlib.h>

extern uint8_t  g_apu_sequence_counter; // DP $9F
extern uint16_t g_current_music_track;  // $0E4B
extern uint16_t g_pending_music_track;  // $0E4D
extern uint16_t g_active_sfx_id;        // $0E4F
extern uint16_t g_apu_lock;             // $0E51
extern uint16_t g_camera_x;             // DP $59
extern uint16_t g_camera_y;             // DP $5B

extern const uint16_t g_sqr_table[];    // $80:AA27
extern const uint8_t  g_attenuation_table[]; // $8C:84D4

extern uint16_t math_sqrt_16(uint16_t value); // $80:AC27

/**
 * $8C:81FD - apu_command_send_sync
 * Sends a 16-bit parameter (Y) and command word (A) to the SPC700 with sequence handshake.
 */
void apu_command_send_sync(uint16_t command_id, uint16_t param_word) {
    // Disable interrupts and acquire lock
    g_apu_lock++;

    // Wait for SPC700 to acknowledge prior packet (timeout loop = 10,240 iterations)
    uint16_t timeout = 0x2800;
    while (timeout > 0) {
        if (REG_APUIO2 == g_apu_sequence_counter) {
            break;
        }
        timeout--;
    }

    // Read current echo from port 2 if timeout expired
    if (timeout == 0) {
        g_apu_sequence_counter = REG_APUIO2;
    }

    // Advance sequence number (skips 0 to avoid collision with reset state)
    g_apu_sequence_counter++;
    if (g_apu_sequence_counter == 0) {
        g_apu_sequence_counter = 1;
    }

    // Write parameters to APU ports 0 & 1, then command + sequence to ports 2 & 3
    REG_APUIO01 = param_word;
    REG_APUIO23 = (command_id & 0x00FF) | ((uint16_t)g_apu_sequence_counter << 8);

    // Release lock
    g_apu_lock--;
}

/**
 * $8C:82DC - sfx_play_dispatch
 * Dispatches a sound effect to the SPC700 via APU command 4.
 */
void sfx_play_dispatch(uint16_t sfx_id) {
    g_active_sfx_id = sfx_id;

    // Send command 0x0004 (Play Sound Effect) with sound effect ID in parameter
    apu_command_send_sync(0x0004, sfx_id);
}

/**
 * $8C:8590 - audio_spatial_panning_and_attenuation
 * Computes 2D spatial distance and stereo panning for sound emitted from entity at (pos_x, pos_y).
 */
void audio_spatial_panning_and_attenuation(uint16_t sfx_id, uint16_t pos_x, uint16_t pos_y) {
    // 1. Calculate vertical distance relative to screen center (Camera Y + 0x70)
    int16_t delta_y = (int16_t)(g_camera_y + 0x0070) - (int16_t)pos_y;
    if (delta_y < 0) {
        delta_y = -delta_y;
    }
    uint16_t dy_scaled = (delta_y >> 4) << 1;

    // 2. Calculate horizontal distance relative to screen center (Camera X + 0x80)
    int16_t raw_delta_x = (int16_t)(g_camera_x + 0x0080) - (int16_t)pos_x;
    int16_t delta_x = raw_delta_x;
    if (delta_x < 0) {
        delta_x = -delta_x;
    }
    uint16_t dx_scaled = (delta_x >> 4) << 1;

    // 3. Euclidean distance lookup: dist_sq = dy^2 + dx^2
    uint16_t dist_sq = g_sqr_table[dy_scaled >> 1] + g_sqr_table[dx_scaled >> 1];

    // Out of audible range check (threshold = 0x3F01)
    uint8_t volume;
    if (dist_sq >= 0x3F01) {
        volume = 0; // Completely attenuated
    } else {
        uint16_t linear_dist = math_sqrt_16(dist_sq);
        volume = g_attenuation_table[linear_dist];
    }

    // 4. Stereo Panning based on raw horizontal offset
    uint8_t pan_left;
    uint8_t pan_right;
    if (raw_delta_x < 0) {
        // Sound source is to the right of the player
        pan_left = volume >> 1;
        pan_right = volume;
    } else {
        // Sound source is to the left of the player
        pan_left = volume;
        pan_right = volume >> 1;
    }

    // 5. Send positional volume / pan command 0x0036 to SPC700
    uint16_t volume_pan_word = ((uint16_t)pan_right << 8) | pan_left;
    apu_command_send_sync(0x0036, volume_pan_word);

    // Trigger sound effect playback
    sfx_play_dispatch(sfx_id);
}
