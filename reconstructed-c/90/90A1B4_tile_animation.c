/*
 * Routine: $90A2A2 (tile_animation)
 * Bank: $90 (ROM Offset: $10A2A2)
 * Source: docs/disassembly/maps/tile-animation.md
 */

#include "maps/tile-animation.h"
#include "engine-core/vram-dma.h"

// ----------------------------------------------------------------------------
// WRAM Bank $7E Animation State Tables
// ----------------------------------------------------------------------------
#define ANIM_MAX_CHANNELS           50

// Base WRAM state arrays
extern uint8_t  g_anim_channel_frame_index[ANIM_MAX_CHANNELS]; // $7E:4FE6..$7E:5017
extern int8_t   g_anim_channel_delay_timer[ANIM_MAX_CHANNELS]; // $7E:5018..$7E:5049
extern uint8_t  g_anim_channel_loop_count[ANIM_MAX_CHANNELS];  // $7E:504A..$7E:507B
extern uint16_t g_anim_slot_table[16];                         // $7E:507D..$7E:509D

// Direct page indirect 24-bit pointer to ROM map animation descriptor
extern const uint8_t *g_rom_anim_descriptor_ptr;               // DP $A7 (24-bit)

/* map_anim_tile_channel_tick_and_vram_stream: exact to the ROM in 90A1B4_map_anim_tile_channel_tick_and_vram_stream.c */

// ----------------------------------------------------------------------------
// map_anim_tile_channel_search_or_activate ($90:A2A2)
// ----------------------------------------------------------------------------
bool map_anim_tile_channel_search_or_activate(uint16_t search_key, uint8_t initial_loops) {
    uint16_t slot_idx = 0;
    uint16_t desc_offset = g_anim_slot_table[slot_idx];

    // Scan descriptor slot table until negative sentinel ($FFFF)
    while ((int16_t)desc_offset >= 0) {
        if (g_rom_anim_descriptor_ptr[desc_offset] == (uint8_t)search_key) {
            // Match found: resolve channel index (offset / 4)
            uint16_t ch = desc_offset >> 2;

            if (g_rom_anim_descriptor_ptr[desc_offset] == (uint8_t)search_key) {
                uint8_t initial_delay = g_rom_anim_descriptor_ptr[desc_offset + 1];

                // Configure channel execution state
                if (initial_loops == 0) {
                    g_anim_channel_frame_index[ch] = 0;
                    g_anim_channel_delay_timer[ch] = 0;
                    g_anim_channel_loop_count[ch] = 0xFF; // Infinite loop
                } else {
                    g_anim_channel_loop_count[ch] = initial_loops;
                    g_anim_channel_delay_timer[ch] = initial_delay;
                }
                return true;
            }
        }

        slot_idx++;
        desc_offset = g_anim_slot_table[slot_idx];
    }

    return false; // Key not present in active room descriptors
}
