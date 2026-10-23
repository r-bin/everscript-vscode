/*
 * Routine: $819900 (sfx_queue)
 * Bank: $81 (ROM Offset: $019900)
 * Source: docs/disassembly/audio/sfx-queue.md
 */

#include <stdint.h>
#include <stdbool.h>

#define APU_CMD_SFX_TRIGGER     0x04
#define APU_PORT_COMMAND        0x2140
#define APU_PORT_PARAM_LOW      0x2141
#define APU_PORT_PARAM_HIGH     0x2142
#define APU_PORT_STATUS         0x2143

#define NUM_SFX_CHANNELS        4    /* SPC700 channels 4 through 7 */

typedef enum {
    SFX_PRIORITY_LOW      = 0,  /* Ambient water droplets, rustling bushes */
    SFX_PRIORITY_NORMAL   = 1,  /* Footsteps, enemy movements */
    SFX_PRIORITY_HIGH     = 2,  /* Weapon swings, hit impacts, spell casts */
    SFX_PRIORITY_CRITICAL = 3   /* Menu clicks, dialogue beeps, level-up fanfares */
} SfxPriority;

typedef struct {
    uint8_t  sfx_id;
    uint8_t  package_id;
    uint8_t  priority;
    uint16_t pitch_offset;
} SfxDescriptor;

typedef struct {
    bool     active;
    uint8_t  current_sfx;
    uint8_t  priority;
    uint16_t remaining_ticks;
} SfxChannelState;

typedef struct {
    uint8_t         loaded_soundbank_id;
    uint8_t         ipc_sequence_counter;
    SfxChannelState channels[NUM_SFX_CHANNELS];
} AudioEngineState;

extern uint16_t rom_read16(uint32_t addr);
extern uint8_t  rom_read8(uint32_t addr);
extern void     spc700_upload_soundbank(uint8_t package_id);
extern void     spc700_handshake_send(uint8_t cmd, uint16_t param);

/**
 * Sends a sound effect trigger command to the SPC700 via hardware port handshake.
 * Corresponds to native routine $8C:831D.
 */
void apu_send_sfx_command(uint16_t sfx_id) {
    /* Command 0x04 = Play SFX; parameter Y = sfx_id */
    spc700_handshake_send(APU_CMD_SFX_TRIGGER, sfx_id);
}

/**
 * Fires a sound effect immediately without checking package residency.
 * Assumes the soundbank is already loaded in SPC700 RAM.
 * Corresponds to native routine $8C:82DC.
 */
void play_sound_effect_direct(AudioEngineState *audio, uint16_t sfx_id) {
    apu_send_sfx_command(sfx_id);
}

/**
 * Checks if the required sound package is loaded in SPC700 RAM before triggering.
 * If not loaded, uploads the BRR package first to prevent audio glitches.
 * Corresponds to native routine $8C:82E3.
 */
void play_sound_effect_with_package(AudioEngineState *audio, uint16_t sfx_id) {
    /* 1. Calculate soundbank package table address ($81:9900) */
    uint16_t base_count = rom_read8(0x819900) + 1;
    uint32_t table_addr = 0x819903 + (base_count * 3);
    uint16_t sub_offset = rom_read8(0x819901);
    
    uint32_t entry_addr = table_addr + sub_offset + sfx_id;
    uint8_t required_package = rom_read8(entry_addr);

    /* 2. Upload soundbank if missing */
    if (audio->loaded_soundbank_id != required_package) {
        spc700_upload_soundbank(required_package);
        audio->loaded_soundbank_id = required_package;
    }

    /* 3. Dispatch SFX trigger command */
    apu_send_sfx_command(sfx_id);
}

/**
 * SPC700 Voice Channel Allocator:
 * Selects an available voice channel (4-7) for an incoming sound effect.
 * Preempts active effects if the new effect has higher priority.
 */
int audio_allocate_sfx_channel(AudioEngineState *audio, uint8_t sfx_id, uint8_t priority) {
    /* Pass 1: Find completely free channel */
    for (int i = 0; i < NUM_SFX_CHANNELS; i++) {
        if (!audio->channels[i].active) {
            audio->channels[i].active = true;
            audio->channels[i].current_sfx = sfx_id;
            audio->channels[i].priority = priority;
            return i;
        }
    }

    /* Pass 2: Preempt lowest priority voice */
    int lowest_channel = -1;
    uint8_t lowest_priority = priority;

    for (int i = 0; i < NUM_SFX_CHANNELS; i++) {
        if (audio->channels[i].priority < lowest_priority) {
            lowest_priority = audio->channels[i].priority;
            lowest_channel = i;
        }
    }

    if (lowest_channel >= 0) {
        audio->channels[lowest_channel].current_sfx = sfx_id;
        audio->channels[lowest_channel].priority = priority;
        return lowest_channel;
    }

    /* Rejected: all voices occupied by higher or equal priority */
    return -1;
}
