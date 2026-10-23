/*
 * Routine: $90A320 (tile_anim_init)
 * Bank: $90 (ROM Offset: $10A320)
 * Source: docs/disassembly/maps/tile-anim-init.md
 */

#include "maps/tile-anim-init.h"
#include <string.h>

// ----------------------------------------------------------------------------
// WRAM Global State Variables
// ----------------------------------------------------------------------------
#define TERRAIN_MUTATION_MAX_CHANNELS  80

// Status & Cursor registers
extern uint16_t g_terrain_mutation_active;       // $7E:0FB0
extern uint16_t g_terrain_cut_dp_cursor;         // DP $00B0
extern uint16_t g_vram_tile_staging_cursor;      // $7E:1170 (0x0000..0x007E)
extern uint16_t g_vram_tile_staging_pending;     // $7E:1172

// 80-channel terrain mutation arrays
extern uint8_t  g_terrain_slot_frame_index[TERRAIN_MUTATION_MAX_CHANNELS]; // $7E:107E..$7E:10CD
extern uint8_t  g_terrain_slot_frame_limit[TERRAIN_MUTATION_MAX_CHANNELS]; // $7E:10CE..$7E:111D
extern uint8_t  g_terrain_slot_countdown[TERRAIN_MUTATION_MAX_CHANNELS];   // $7E:111E..$7E:116D

// ----------------------------------------------------------------------------
// Hardware Constants
// ----------------------------------------------------------------------------
#define TERRAIN_SLOT_INACTIVE_SENTINEL  0xFF

/**
 * map_tile_anim_and_cuttable_terrain_init ($90:A320)
 *
 * Flushes active terrain mutation sequences, resets VRAM staging ring buffer
 * write cursors, and initializes all 80 terrain animation channel slots using
 * two hardware DMA transfers into WRAM Bank $7E.
 */
void map_tile_anim_and_cuttable_terrain_init(void) {
    // 1. Reset master subsystem active flags and staging cursors
    g_terrain_mutation_active   = 0;
    g_terrain_cut_dp_cursor     = 0;
    g_vram_tile_staging_cursor  = 0;
    g_vram_tile_staging_pending = 0;

    // 2. Hardware DMA Channel 1 Phase 1: Zero-fill 160 bytes ($7E:107E..$7E:111D)
    // In SNES hardware, this reads 0x00 from $80:8000 via fixed-source DMA to $2180.
    memset((void*)g_terrain_slot_frame_index, 0x00, TERRAIN_MUTATION_MAX_CHANNELS);
    memset((void*)g_terrain_slot_frame_limit, 0x00, TERRAIN_MUTATION_MAX_CHANNELS);

    // 3. Hardware DMA Channel 1 Phase 2: Sentinel-fill 80 bytes ($7E:111E..$7E:116D)
    // In SNES hardware, this reads 0xFF from $80:8DB2 via fixed-source DMA to $2180.
    // Marks every slot as inactive/free.
    memset((void*)g_terrain_slot_countdown, TERRAIN_SLOT_INACTIVE_SENTINEL, TERRAIN_MUTATION_MAX_CHANNELS);
}
