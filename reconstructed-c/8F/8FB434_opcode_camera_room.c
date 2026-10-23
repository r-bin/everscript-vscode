/*
 * Routine: $8FB434 (opcode_camera_room)
 * Bank: $8F (ROM Offset: $0FB434)
 * Source: docs/disassembly/script-vm/opcode-camera-room.md
 */

#include <stdint.h>
#include <stdbool.h>

typedef struct {
    uint8_t  padding0[0x60];
    uint16_t anim_descriptor_ptr; // +0x60: Animation descriptor in Bank $8E
} Entity;

#define DP_SCRIPT_PC         (*(volatile uint8_t**)0x82)
#define DP_SCRIPT_BANK       (*(volatile uint16_t*)0x83)   // pointer bytes $83-$84; 0 = this script has ended
#define DP_RUN_LIST_INDEX    (*(volatile int16_t*)0x80)    // position in the run list $2F28

#define DP_POS_Z             (*(volatile uint16_t*)0x44)
#define DP_POS_X             (*(volatile uint16_t*)0x46)
#define DP_POS_Y             (*(volatile uint16_t*)0x48)
#define DP_TARGET_ENTITY     (*(volatile Entity**)0x4C)

#define WRAM_TARGET_ROOM_ID  (*(volatile uint16_t*)0x7E0ADB)
#define WRAM_BOY_ENTITY_PTR  (*(volatile Entity**)0x7E0F3E)
#define WRAM_DOG_ENTITY_PTR  (*(volatile Entity**)0x7E0F40)

// External Subroutines
extern void screen_fade_to_black(void);                       // $80:85D8
extern void script_stop_all_threads(void);                    // $8C:CEE9
extern void script_start_room_enter_script(void);             // $8C:CE99
extern void audio_stop_all(void);                             // $8F:B38E
extern void reset_per_room_state(uint16_t room_id);           // $90:8E90
extern void coord_clamp_boundaries(uint16_t *x, uint16_t *y); // $90:9815
extern void camera_center_on_coords(uint16_t x, uint16_t y);  // $8F:A93B
extern void entity_set_position_with_z(Entity *e, uint16_t x, uint16_t y, uint16_t z); // $8F:C2E4
extern void vram_stream_character_tiles(uint16_t tile_idx);   // $90:80CE

/**
 * $8F:B458 - Teleports a character to target coordinates and streams its idle sprite to VRAM.
 */
static void character_spawn_stream_vram(Entity *character) {
    if (!character) return;

    DP_TARGET_ENTITY = character;

    // Reposition character and re-calculate map tile collision flags
    entity_set_position_with_z(character, DP_POS_X, DP_POS_Y, DP_POS_Z);

    // Read spawn animation graphic tile from descriptor +0x32
    const uint8_t *desc = (const uint8_t*)(*(const uint16_t*)(0x8E0000 + character->anim_descriptor_ptr));
    uint16_t spawn_tile_idx = *(const uint16_t*)(desc + 0x32);

    // Stream character idle sprite tiles into VRAM
    vram_stream_character_tiles(spawn_tile_idx);
}

/**
 * $8F:B434 - Centers camera viewport on (X, Y) and teleports Boy and Dog to spawn points.
 */
void spawn_characters_and_position_camera(uint16_t x, uint16_t y) {
    uint16_t target_x = x;
    uint16_t target_y = y;

    // Clamp coordinates to room boundaries
    coord_clamp_boundaries(&target_x, &target_y);

    // Snap camera viewport to coordinates
    camera_center_on_coords(target_x, target_y);

    // Position Boy and reload sprite
    if (WRAM_BOY_ENTITY_PTR != NULL) {
        character_spawn_stream_vram(WRAM_BOY_ENTITY_PTR);
    }

    // Position Dog and reload sprite
    if (WRAM_DOG_ENTITY_PTR != NULL) {
        character_spawn_stream_vram(WRAM_DOG_ENTITY_PTR);
    }
}

/**
 * $8C:DBF0 - Script VM Opcode 0x20: camera_scroll_instant(x_tiles, y_tiles)
 * Instantly centers camera and updates spawn coordinates without fading.
 */
bool script_op_camera_scroll_instant(void) {
    uint16_t x_tiles = *DP_SCRIPT_PC++;
    uint16_t y_tiles = *DP_SCRIPT_PC++;

    DP_POS_X = x_tiles << 3; // Immediate * 8
    DP_POS_Y = y_tiles << 3;
    DP_POS_Z = 0;

    spawn_characters_and_position_camera(DP_POS_X, DP_POS_Y);

    // SEC: Continue execution in the current turn
    return true;
}

/**
 * $8C:DBB9 - Script VM Opcode 0x21: camera_warp_fade(x_tiles, y_tiles)
 * Stops every thread, places the party, starts the room's enter script again; ends this script.
 */
bool script_op_camera_warp_fade(void) {
    screen_fade_to_black();
    script_stop_all_threads();
    audio_stop_all();

    uint16_t x_tiles = *DP_SCRIPT_PC++;
    uint16_t y_tiles = *DP_SCRIPT_PC++;

    DP_POS_X = x_tiles << 3;
    DP_POS_Y = y_tiles << 3;
    DP_POS_Z = 0;

    spawn_characters_and_position_camera(DP_POS_X, DP_POS_Y);

    script_start_room_enter_script();
    DP_SCRIPT_BANK = 0;       // this script is over
    DP_RUN_LIST_INDEX = -2;   // the scheduler restarts at the head of the (new) run list

    // CLC: this thread's turn ends (the script is already over)
    return false;
}

/**
 * $8C:DB71 - Script VM Opcode 0x22: map_transition(x_tiles, y_tiles, room_id)
 * Full room change: stops every thread, writes the map word to $0ADB, resets the per-room state,
 * places the party and starts the new room's enter script; ends this script.
 */
bool script_op_map_transition_room(void) {
    screen_fade_to_black();
    script_stop_all_threads();
    audio_stop_all();

    uint16_t x_tiles = *DP_SCRIPT_PC++;
    uint16_t y_tiles = *DP_SCRIPT_PC++;

    uint16_t room_id = *(const uint16_t*)DP_SCRIPT_PC;
    DP_SCRIPT_PC += 2;

    WRAM_TARGET_ROOM_ID = room_id;

    // Deallocate previous map assets, load metatiles, collision tables, and palettes
    reset_per_room_state(room_id);

    DP_POS_X = x_tiles << 3;
    DP_POS_Y = y_tiles << 3;
    DP_POS_Z = 0;

    spawn_characters_and_position_camera(DP_POS_X, DP_POS_Y);

    script_start_room_enter_script();
    DP_SCRIPT_BANK = 0;       // this script is over
    DP_RUN_LIST_INDEX = -2;   // the scheduler restarts at the head of the (new) run list

    // CLC: this thread's turn ends (the script is already over)
    return false;
}
