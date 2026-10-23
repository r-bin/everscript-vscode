/*
 * Routine: $90A1B4 (tile_animation)
 * Bank: $90 (ROM Offset: $10A1B4)
 * Source: docs/disassembly/maps/tile-animation.md
 */

#include "maps/tile-animation.h"
#include "engine-core/vram-dma.h"

// ----------------------------------------------------------------------------
// WRAM Bank $7E Animation State Tables
// ----------------------------------------------------------------------------
#define ANIM_MAX_CHANNELS           50
#define ANIM_MAX_UPDATES_PER_FRAME  10

// Base WRAM state arrays
extern uint8_t  g_anim_channel_frame_index[ANIM_MAX_CHANNELS]; // $7E:4FE6..$7E:5017
extern int8_t   g_anim_channel_delay_timer[ANIM_MAX_CHANNELS]; // $7E:5018..$7E:5049
extern uint8_t  g_anim_channel_loop_count[ANIM_MAX_CHANNELS];  // $7E:504A..$7E:507B
extern uint16_t g_anim_slot_table[16];                         // $7E:507D..$7E:509D

extern uint16_t g_active_anim_channel_count;                   // $7E:106C
extern uint16_t g_anim_vram_base_tile_slot;                    // $7E:106E
extern uint16_t g_per_frame_vram_budget;                       // DP $00D8

// Direct page indirect 24-bit pointer to ROM map animation descriptor
extern const uint8_t *g_rom_anim_descriptor_ptr;               // DP $A7 (24-bit)

// Bank $EE Master Graphics Catalog
extern const uint8_t g_rom_bank_ee_tiles[];                    // $EE:0000

// ----------------------------------------------------------------------------
// map_anim_tile_channel_tick_and_vram_stream ($90:A1B4)
// ----------------------------------------------------------------------------
void map_anim_tile_channel_tick_and_vram_stream(void) {
    uint16_t update_budget = ANIM_MAX_UPDATES_PER_FRAME; // DP $02 = 10
    uint16_t total_channels = g_active_anim_channel_count;
    uint16_t ch = 0;

    // Scan all active animation channels
    while (ch < total_channels) {
        // Skip inactive or paused channels
        if (g_anim_channel_loop_count[ch] == 0) {
            ch++;
            continue;
        }

        // Decrement channel countdown delay
        g_anim_channel_delay_timer[ch]--;
        if (g_anim_channel_delay_timer[ch] >= 0) {
            // Still in active keyframe duration
            ch++;
            continue;
        }

        // Timer expired: Advance to next animation frame
        uint16_t desc_offset = ch * 4 + 1;
        uint8_t max_frames = g_rom_anim_descriptor_ptr[desc_offset];
        
        uint8_t current_frame = g_anim_channel_frame_index[ch] + 1;
        if (current_frame >= max_frames) {
            current_frame = 0; // Wraparound to start of sequence
        }
        g_anim_channel_frame_index[ch] = current_frame;

        // Resolve frame record offset: base + (frame * 3)
        uint16_t frame_rec_base = *(const uint16_t *)&g_rom_anim_descriptor_ptr[desc_offset + 1];
        uint16_t frame_rec_offset = frame_rec_base + (current_frame * 3);

        // Read frame duration and reload countdown timer
        uint8_t frame_duration = g_rom_anim_descriptor_ptr[frame_rec_offset];
        g_anim_channel_delay_timer[ch] += frame_duration;

        // Decrement loop counter unless configured for infinite looping (0xFF)
        if (g_anim_channel_loop_count[ch] != 0xFF) {
            g_anim_channel_loop_count[ch]--;
        }

        // Compute destination VRAM planar address
        // Tile slot: (channel + base_slot) * 32
        uint16_t tile_slot = (ch + g_anim_vram_base_tile_slot) * 32;
        uint16_t vram_dest_word = (tile_slot & 0x00E0) | ((tile_slot << 1) & 0xFE00);

        // Resolve source graphic pointer in Bank $EE
        uint16_t rom_source_offset = *(const uint16_t *)&g_rom_anim_descriptor_ptr[frame_rec_offset + 1];
        const uint8_t *source_data = &g_rom_bank_ee_tiles[rom_source_offset];

        // Stream 128 bytes (16x16 4bpp tile = two 64-byte halves) into VRAM via DMA Channel 1
        // First 64-byte block
        vram_dma_upload_tile_block(source_data, vram_dest_word, 64);
        
        // Second 64-byte block (offset by +64 bytes, VRAM +0x0100)
        vram_dma_upload_tile_block(source_data + 64, vram_dest_word + 0x0100, 64);

        // Deduct from per-frame transmission budget
        update_budget--;
        ch++;

        // If transfer budget exhausted, drain remaining channel timers without DMA
        if (update_budget == 0) {
            while (ch < total_channels) {
                if (g_anim_channel_loop_count[ch] != 0) {
                    g_anim_channel_delay_timer[ch]--;
                }
                ch++;
            }
            break;
        }
    }

    // Account for VRAM bandwidth: deduct (updates * 16 words) from DP $00D8
    uint16_t updates_performed = ANIM_MAX_UPDATES_PER_FRAME - update_budget;
    uint16_t words_consumed = updates_performed * 16;
    
    if (g_per_frame_vram_budget >= words_consumed) {
        g_per_frame_vram_budget -= words_consumed;
    } else {
        g_per_frame_vram_budget = 0;
    }
}

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
