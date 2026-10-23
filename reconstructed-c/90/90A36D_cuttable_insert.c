/*
 * Routine: $90A36D (cuttable_insert)
 * Bank: $90 (ROM Offset: $10A36D)
 * Source: docs/disassembly/maps/cuttable-insert.md
 */

#include "maps/cuttable-insert.h"

// ----------------------------------------------------------------------------
// WRAM Global State Variables
// ----------------------------------------------------------------------------
#define MAP_OBJECT_MAX_SLOTS  80

extern uint16_t g_terrain_mutation_active;       // $7E:0FB0
extern uint16_t g_room_object_pointer_table;     // $7E:0FA2 (Offset into room blob)

extern uint8_t  g_map_object_target_frame[MAP_OBJECT_MAX_SLOTS];  // $7E:107E..$7E:10CD
extern uint8_t  g_map_object_current_frame[MAP_OBJECT_MAX_SLOTS]; // $7E:10CE..$7E:111D
extern uint8_t  g_map_object_sentinel[MAP_OBJECT_MAX_SLOTS];      // $7E:111E..$7E:116D

extern uint8_t  g_environmental_sfx_trigger;     // $7E:0FB9
extern uint8_t  g_environmental_shake_trigger;   // $7E:0FBD
extern uint8_t  g_environmental_sfx_param;       // $7E:0FBF

extern uint8_t  g_joypad_edge_state;             // $7E:0106

// Direct Page & Room Blob Pointers
extern uint8_t* const g_room_blob_base;          // Pointer [$8B]
extern uint8_t* const g_object_state_table;      // Pointer [$AA]

// Subroutine prototypes
void minimap_radar_blip_update(void);            // $90:A5BA
void map_metatile_and_vram_commit(uint16_t frame); // $90:A5D0

/**
 * map_object_state_step_interpolator ($90:A36D)
 *
 * Sets the target keyframe for map object slot X, clamping it to the sequence
 * limit defined in the room blob. If immediate progression is requested,
 * executes forward or backward stepping until the current frame matches the target.
 *
 * @param slot_index Object channel slot index [0..79] (Register X)
 * @param target_step Requested keyframe step index (Register A)
 * @param flags Direct Page $13 modifier flags
 */
void map_object_state_step_interpolator(uint16_t slot_index, int16_t target_step, uint8_t flags) {
    if (slot_index >= MAP_OBJECT_MAX_SLOTS) {
        return;
    }

    g_terrain_mutation_active = 1;

    // 1. Resolve sequence offset from room blob Object Pointer Table
    uint16_t table_offset = g_room_object_pointer_table + (slot_index * 2);
    uint16_t seq_ptr = *(uint16_t*)(g_room_blob_base + table_offset);

    // 2. Clamp target step against sequence maximum in [$AA]
    uint8_t max_step = *(uint8_t*)(g_object_state_table + seq_ptr);
    uint8_t clamped_target = (target_step < 0) ? 0 : (uint8_t)target_step;
    if (clamped_target > max_step) {
        clamped_target = max_step;
    }

    // 3. Persist new target frame
    g_map_object_target_frame[slot_index] = clamped_target;

    // 4. If current frame already matches target, mark slot idle and return
    if (clamped_target == g_map_object_current_frame[slot_index]) {
        g_map_object_sentinel[slot_index] = 0xFF;
        return;
    }

    // Arm slot timer
    g_map_object_sentinel[slot_index] = 0x00;

    // 5. Test if immediate stepping is enabled
    if (!(flags & 0x80) && !(g_joypad_edge_state & 0x80)) {
        return; // Deferred to per-frame map effects tick
    }

    // --- Subroutine $90:A3AC: Execute Synchronous Step Loop ---
    g_map_object_sentinel[slot_index] = 0xFF; // Mark slot busy during transition

    uint8_t current = g_map_object_current_frame[slot_index];

    if (current < clamped_target) {
        // Forward stepping loop (0x40 sfx: cut grass sound effect)
        do {
            minimap_radar_blip_update();
            map_metatile_and_vram_commit(g_map_object_current_frame[slot_index]);

            g_environmental_sfx_trigger   = 0x40;
            g_environmental_shake_trigger = 0x40;
            g_environmental_sfx_param     = 0x40;

            g_map_object_current_frame[slot_index]++;
        } while (g_map_object_current_frame[slot_index] != clamped_target);

        minimap_radar_blip_update();
    } else {
        // Backward stepping loop (Rewind / Regeneration)
        do {
            g_map_object_current_frame[slot_index]--;

            minimap_radar_blip_update();
            map_metatile_and_vram_commit(g_map_object_current_frame[slot_index]);

            g_environmental_sfx_trigger   = 0x40;
            g_environmental_shake_trigger = 0x40;
            g_environmental_sfx_param     = 0x40;
        } while (g_map_object_current_frame[slot_index] != clamped_target);

        minimap_radar_blip_update();
    }
}
