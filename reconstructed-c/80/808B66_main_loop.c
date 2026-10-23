/*
 * Routine: $808B66 (main_loop)
 * Bank: $80 (ROM Offset: $008B66)
 * Source: docs/disassembly/engine-core/main-loop.md
 */

#include <stdint.h>
#include <stdbool.h>

extern uint16_t g_current_room_id;  /* $7E:0ADB */
extern uint16_t g_frame_counter;    /* $7E:0100 */
extern uint16_t g_map_flags_22eb;   /* $7E:22EB */
extern uint16_t g_system_flags_22ea;/* $7E:22EA */
extern uint16_t g_ppu_shadow_0106;  /* $7E:0106 */

void validate_sram_slots(void);
void apu_handshake_spinlock(uint16_t command);
void enter_room(uint16_t room_id);
void entity_physics_update(void);
void screen_fade_driver(void);
void script_vm_scheduler_run_turn(void);
void update_hud_and_rings(void);
void audio_driver_update(void);
void queue_vram_transfers(void);
void post_vblank_frame_reset(void);

void wait_for_frame(void) {
    uint16_t last_frame = g_frame_counter;
    while (g_frame_counter == last_frame) {
        /* Busy-wait until NMI increments $7E:0100 */
    }
    post_vblank_frame_reset(); /* $80:8F85 */
}

void main_loop_entry(void) {
    /* Step 1: Validate SRAM and select active slot */
    validate_sram_slots();

    /* Step 2: Establish handshake with APU / SPC700 */
    apu_handshake_spinlock(0x0016);

    /* Step 3: Read starting room ID from ROM ($92:8002) and execute Enter Room */
    uint16_t initial_room = *(const uint16_t *)0x928002;
    g_current_room_id = initial_room;
    enter_room(g_current_room_id); /* $8E:E4E2 */

    /* Step 4: The Continuous Per-Frame Loop */
    for (;;) {
        /* Sync execution to the start of the next display field */
        wait_for_frame();

        /* Update entities, collision, and animation state */
        entity_physics_update(); /* $80:9685 */
        screen_fade_driver();     /* $8E:E08B */

        /* Check if a room transition or teleport was requested */
        if (g_map_flags_22eb & 0x0004) {
            g_map_flags_22eb &= ~0x0004;
            enter_room(g_current_room_id);
            continue;
        }

        /* Standard gameplay update */
        update_hud_and_rings();           /* $80:8CB5 */
        script_vm_scheduler_run_turn();   /* $8C:CFFD via $8D:8000 */
        audio_driver_update();            /* $8C:828F */

        /* Ensure screen is unblanked */
        g_ppu_shadow_0106 = 0x0000; /* Brightness full, screen on */

        /* Queue tile, sprite, and palette DMA uploads for next VBLANK */
        queue_vram_transfers(); /* $8D:82CB */
    }
}
