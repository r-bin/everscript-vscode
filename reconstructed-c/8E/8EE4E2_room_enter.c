/*
 * Routine: $8EE4E2 (room_enter)
 * Bank: $8E (ROM Offset: $0EE4E2)
 * Source: docs/disassembly/engine-core/room-enter.md
 */

#include <stdint.h>
#include <stdbool.h>

extern uint16_t g_current_room_id;     /* $7E:0ADB */
extern uint16_t g_system_state_flags;  /* $7E:22EA */
extern uint16_t g_spawn_script_flags;  /* $7E:05A9 */
extern uint16_t g_room_timer_0b57;     /* $7E:0B57 */
extern uint16_t g_room_counter_0b77;   /* $7E:0B77 */
extern uint16_t g_vram_queue_lock;     /* $7E:0F3A */
extern uint16_t g_room_width;          /* $7E:0F86 */
extern uint16_t g_room_height;         /* $7E:0F88 */
extern int16_t  g_camera_target_x;     /* $7E:242B */
extern int16_t  g_camera_target_y;     /* $7E:242D */

void apu_handshake_spinlock(uint16_t command);
void reset_per_room_state(void);
void script_start_room_enter_script(uint16_t room_id);
void spawn_script_thread(uint32_t script_ptr);
void run_single_frame_tick(void);
void init_camera_and_collision(void);

/**
 * Resets per-room state, initializes camera margins, locks VRAM uploads,
 * and extracts room dimensions from ROM table $9F:FDE7.
 */
void reset_per_room_state(void) {
    /* 1. Reset collision grid and trigger boundaries */
    clear_collision_grid();       /* $91:9795 */
    clear_step_on_triggers();     /* $8F:B229 */

    /* 2. Clear screen shake and transient animation state */
    clear_screen_shake();

    /* 3. Configure camera deadzones and tracking speeds */
    set_camera_deadzones(72, 72, 104, 56);
    set_camera_speed(0x0080, 0x0015);

    /* 4. Force camera target to follow active player entity */
    g_camera_target_x = -1;
    g_camera_target_y = -1;

    /* 5. Lock VRAM upload queue during room decompression */
    g_vram_queue_lock++;

    /* 6. Look up room metatile dimensions from ROM table $9F:FDE7 */
    const uint8_t *room_table = (const uint8_t *)(0x9F0000 | *(const uint16_t *)(0x9FFDE7 + g_current_room_id * 4));
    g_room_width  = room_table[0];
    g_room_height = room_table[1];
}

/**
 * Primary room enter orchestrator: silences audio, resets room state,
 * kicks off enter scripts, and advances frames until ready to render.
 */
void enter_room(uint16_t room_id) {
    /* 1. Stop audio and fade background sound effects */
    apu_handshake_spinlock(0x001A);
    apu_handshake_spinlock(0x001C);

    /* 2. Reset per-room structures and camera */
    reset_per_room_state();

    /* 3. Look up and trigger room enter script */
    script_start_room_enter_script(room_id);

    /* 4. Reset room frame timer and iteration counter */
    g_room_timer_0b57 = 0x3074;
    g_room_counter_0b77++;

    /* 5. Pre-roll frames until all subsystems (tiles, entities, fade) are ready */
    for (;;) {
        /* Check if player (Boy) spawn script is queued */
        if (g_spawn_script_flags & 0x0002) {
            g_spawn_script_flags &= ~0x0002;
            spawn_script_thread(0x8E994E89);
        }

        /* Check if companion (Dog) spawn script is queued */
        if (g_spawn_script_flags & 0x0004) {
            g_spawn_script_flags &= ~0x0004;
            spawn_script_thread(0x8E994F37);
        }

        /* Advance 1 engine frame tick */
        run_single_frame_tick(); /* $8E:E41E */

        /* Check if room is fully ready (Bits 3, 4, 5 of $7E:22EA must all be set) */
        const uint16_t kReadyMask = (1 << 3) | (1 << 4) | (1 << 5); /* 0x0038 */
        if ((g_system_state_flags & kReadyMask) == kReadyMask) {
            break;
        }
    }

    /* 6. Compute initial camera coordinates and collision vectors */
    init_camera_and_collision(); /* $8E:E592 */
}
