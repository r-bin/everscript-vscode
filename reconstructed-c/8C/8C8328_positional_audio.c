/*
 * Routine: $8C8328 (positional_audio)
 * Bank: $8C (ROM Offset: $0C8328)
 * Source: docs/disassembly/audio/positional-audio.md
 */

/**
 * @file positional-audio.c
 * @brief Secret of Evermore 2D Positional Audio Spatialization & Attenuation
 *
 * Source: Bank $8C ($8C:8328 - $8C:8657)
 */

#include <stdint.h>
#include <stdbool.h>
#include <stdlib.h>

#define MAX_STEREO_PAN_LEFT        100   /* +100 units */
#define MAX_STEREO_PAN_RIGHT     (-100)  /* -100 units ($FF9C) */
#define AUDIBLE_DISTANCE_LIMIT    0x3F01

#define APU_CMD_PLAY_ATTENUATED_SFX   0x0036
#define APU_CMD_SET_SFX_STEREO_PAN    0x003E
#define APU_CMD_SET_MASTER_VOLUME     0x0028

/**
 * @brief Global Audio & Camera State
 */
typedef struct {
    uint16_t camera_x;              /* DP $59: Camera viewport left edge */
    uint16_t camera_y;              /* DP $5B: Camera viewport top edge */
    uint16_t active_bgm_track;      /* $7E:0E44: Current music track ID */
    uint16_t active_sfx_id;         /* $7E:0E4F: Active SFX parameter */
    uint8_t  fade_step_rate;        /* DP $9A: Volume fade step increment */
    int8_t   fade_target_vol;       /* DP $9B: Volume fade target (signed) */
} AudioEngineState;

/* External Hardware & Table Interfaces */
extern void apu_ipc_handshake(uint16_t command, uint16_t parameter); /* $8C:81FD */
extern uint16_t lookup_distance_penalty(uint16_t delta_index);       /* $80:AA27 */
extern uint8_t lookup_attenuation_curve(uint16_t penalty_sum);       /* $8C:84D4 */

/**
 * @brief Resolves the required soundbank sample package for a track or SFX ($8C:8328).
 *
 * @param state Active audio state
 * @param is_sfx true if resolving for sound effect, false if BGM track
 * @param rom_bank81 Pointer to Bank $81 master soundbank catalog
 * @return uint8_t 8-bit sample package ID to upload into SPC700 ARAM
 */
uint8_t audio_resolve_soundbank_package(const AudioEngineState *state, bool is_sfx, const uint8_t *rom_bank81)
{
    uint8_t header_dim = rom_bank81[0x9900];
    uint16_t table_base = 0x9903 + ((header_dim + 1) * 3);

    uint16_t catalog_offset;
    if (!is_sfx) {
        catalog_offset = table_base + state->active_bgm_track;
    } else {
        uint8_t sfx_section = rom_bank81[0x9901];
        catalog_offset = table_base + sfx_section + state->active_sfx_id;
    }

    return rom_bank81[catalog_offset];
}

/**
 * @brief Plays a 2D sound effect with dynamic distance attenuation and stereo panning ($8C:8589).
 *
 * @param state Active camera and audio state
 * @param sfx_id Sound effect ID
 * @param emitter_x Emitter world X coordinate
 * @param emitter_y Emitter world Y coordinate
 */
void audio_play_positional_sfx(const AudioEngineState *state, uint8_t sfx_id, uint16_t emitter_x, uint16_t emitter_y)
{
    /* 1. Calculate Screen-Centered Delta Coordinates */
    int16_t center_x = (int16_t)(state->camera_x + 128);
    int16_t center_y = (int16_t)(state->camera_y + 112);

    int16_t raw_dx = center_x - (int16_t)emitter_x;
    int16_t raw_dy = center_y - (int16_t)emitter_y;

    uint16_t abs_dx = (uint16_t)abs(raw_dx);
    uint16_t abs_dy = (uint16_t)abs(raw_dy);

    /* 2. Quantize Deltas for Table Stride: (delta >> 4) * 2 */
    uint16_t idx_x = (abs_dx >> 4) << 1;
    uint16_t idx_y = (abs_dy >> 4) << 1;

    /* 3. Distance Attenuation & Audible Threshold Check */
    uint16_t penalty_x = lookup_distance_penalty(idx_x);
    uint16_t penalty_y = lookup_distance_penalty(idx_y);
    uint16_t total_distance = penalty_x + penalty_y;

    uint8_t volume = 0;
    if (total_distance < AUDIBLE_DISTANCE_LIMIT) {
        volume = lookup_attenuation_curve(total_distance);
    }

    /* 4. Transmit Volume Command to SPC700 */
    uint16_t vol_param = ((uint16_t)volume << 8) | sfx_id;
    apu_ipc_handshake(APU_CMD_PLAY_ATTENUATED_SFX, vol_param);

    /* 5. Compute Signed Stereo Panning: raw_dx / 8 clamped to [-100, +100] */
    int16_t pan = raw_dx >> 3;
    if (pan > MAX_STEREO_PAN_LEFT) {
        pan = MAX_STEREO_PAN_LEFT;
    } else if (pan < MAX_STEREO_PAN_RIGHT) {
        pan = MAX_STEREO_PAN_RIGHT;
    }

    /* 6. Transmit Stereo Panning Command to SPC700 */
    uint16_t pan_param = ((uint16_t)(uint8_t)(int8_t)pan << 8) | sfx_id;
    apu_ipc_handshake(APU_CMD_SET_SFX_STEREO_PAN, pan_param);
}

/**
 * @brief Advances the master music volume fade step ($8C:8619).
 *
 * @param state Active audio state
 */
void audio_music_fade_step(AudioEngineState *state)
{
    if (state->fade_target_vol == 0) {
        return;
    }

    if (state->fade_target_vol > 0) {
        /* Fade In */
        int16_t new_vol = state->fade_target_vol + state->fade_step_rate;
        if (new_vol >= 255) {
            state->fade_target_vol = 0;
            apu_ipc_handshake(APU_CMD_SET_MASTER_VOLUME, 0x85FF);
        } else {
            state->fade_target_vol = (int8_t)new_vol;
        }
    } else {
        /* Fade Out */
        int16_t new_vol = state->fade_target_vol - state->fade_step_rate;
        if (new_vol <= -128) {
            state->fade_target_vol = 0;
            apu_ipc_handshake(APU_CMD_SET_MASTER_VOLUME, 0x0000);
        } else {
            state->fade_target_vol = (int8_t)new_vol;
        }
    }
}
