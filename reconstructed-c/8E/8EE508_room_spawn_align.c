/*
 * Routine: $8EE508 (room_spawn_align)
 * Bank: $8E (ROM Offset: $0EE508)
 * Source: docs/disassembly/maps/room-spawn-align.md
 */

#include <stdint.h>
#include <stdbool.h>

#define ROOM_FLAG_TILES_LOADED     0x0008  /* $7E:22EA bit 3 */
#define ROOM_FLAG_ENTITIES_ALIGNED 0x0010  /* $7E:22EA bit 4 */
#define ROOM_FLAG_PALETTE_READY    0x0020  /* $7E:22EA bit 5 */
#define ROOM_READY_ALL_MASK        (ROOM_FLAG_TILES_LOADED | ROOM_FLAG_ENTITIES_ALIGNED | ROOM_FLAG_PALETTE_READY)

#define SPAWN_BOY_SCRIPT_BIT       0x0002  /* $7E:05A9 bit 1 */
#define SPAWN_DOG_SCRIPT_BIT       0x0004  /* $7E:05A9 bit 2 */

#define APU_CMD_SET_VOLUME         0x0028
#define APU_CMD_SILENCE_SFX        0x001A
#define APU_CMD_RESET_DSP_ECHO     0x001C

/* WRAM State */
typedef struct {
    uint16_t spawn_triggers;      /* $7E:05A9 */
    uint16_t current_volume;      /* $7E:0106: bit 7 = mute, bits 3..0 = level */
    int16_t  target_volume_fade;  /* $7E:0B83: -1 / 0xFF = inactive */
    uint16_t volume_fade_counter; /* $7E:0B7F */
    uint16_t room_state_flags;    /* $7E:22EA */
} RoomEntranceSystemState;

extern RoomEntranceSystemState g_room_state;

/* External Subsystems */
extern void script_spawn_thread(uint32_t script_address);       /* $8E:A091 */
extern void per_frame_field_tick(void);                         /* $8E:E41E */
extern void wait_for_vblank(void);                              /* $80:858C */
extern void apu_send_command(uint16_t cmd, uint16_t arg);       /* $8C:8619 */
extern void sound_reset_latches(void);                          /* $80:85D8 */

/**
 * Executes the room transition audio fade-out, silences SFX, and resets DSP echo.
 * Corresponds to native routine $8E:E592.
 */
void room_transition_audio_fadeout_and_dsp_reset(void) {
    uint16_t vol_level = g_room_state.current_volume & 0x000F;
    g_room_state.volume_fade_counter = vol_level;

    // Step-down volume loop
    while (g_room_state.volume_fade_counter > 0) {
        wait_for_vblank();

        uint16_t attenuation = (g_room_state.volume_fade_counter << 4) & 0x00F0;
        apu_send_command(APU_CMD_SET_VOLUME, attenuation);

        // Update current volume mirror preserving mute bit
        g_room_state.current_volume = (g_room_state.current_volume & 0x0080) |
                                      (g_room_state.volume_fade_counter & 0x000F);

        g_room_state.volume_fade_counter--;
    }

    g_room_state.volume_fade_counter = 0;

    // Silence SFX and reset DSP echo buffers
    apu_send_command(APU_CMD_SILENCE_SFX, 0x0000);
    apu_send_command(APU_CMD_RESET_DSP_ECHO, 0x8000);
    sound_reset_latches();
}

/**
 * Pre-roll coordination loop: spawns character initialization scripts and executes
 * field ticks until collision, entities, and palettes are fully prepared.
 * Corresponds to native routine $8E:E508.
 */
void room_enter_pre_roll_wait_and_entity_spawn(void) {
    while (true) {
        // Test and spawn Boy script
        if (g_room_state.spawn_triggers & SPAWN_BOY_SCRIPT_BIT) {
            g_room_state.spawn_triggers &= ~SPAWN_BOY_SCRIPT_BIT;
            script_spawn_thread(0x8E4E89); // Script: Boy Spawn
        }
        // Test and spawn Dog script
        else if (g_room_state.spawn_triggers & SPAWN_DOG_SCRIPT_BIT) {
            g_room_state.spawn_triggers &= ~SPAWN_DOG_SCRIPT_BIT;
            script_spawn_thread(0x8E4F37); // Script: Dog Spawn
        }

        // Advance 1 field frame
        per_frame_field_tick();

        // Check if map collision, entity positions, and palettes are all ready
        if ((g_room_state.room_state_flags & ROOM_READY_ALL_MASK) == ROOM_READY_ALL_MASK) {
            room_transition_audio_fadeout_and_dsp_reset();
            return; // Room transition complete, ready for interactive gameplay!
        }
    }
}

/**
 * Per-frame master volume interpolation helper ($8E:E5FC).
 * Smoothly ramps master volume toward target level every frame.
 */
void audio_master_volume_fade_tick(void) {
    // If master mute flag is set, do not alter volume
    if (g_room_state.current_volume & 0x0080) {
        return;
    }

    // Inactive if target volume latch is negative
    if (g_room_state.target_volume_fade < 0) {
        return;
    }

    uint8_t target = (uint8_t)g_room_state.target_volume_fade;
    uint8_t current = (uint8_t)(g_room_state.current_volume & 0x000F);

    if (current > target) {
        current--;
        g_room_state.current_volume = (g_room_state.current_volume & ~0x000F) | current;
    } else if (current < target) {
        current++;
        g_room_state.current_volume = (g_room_state.current_volume & ~0x000F) | current;
    }

    // If target has been reached, finalize fade
    if (current == target) {
        g_room_state.target_volume_fade = -1; // Clear fade latch
    }
}
