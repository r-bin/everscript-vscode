/*
 * Routine: $90A4EC (minimap_projection)
 * Bank: $90 (ROM Offset: $10A4EC)
 * Source: docs/disassembly/ui/minimap-projection.md
 */

#include <stdint.h>
#include <stdbool.h>

#define RADAR_WINDOW_CAPACITY 128
#define MAX_RADAR_POI_SLOTS   4
#define RADAR_SENTINEL_COORD  0x8000

typedef struct {
    // Radar Viewport Window Clamps
    uint16_t window_top;         // $7E:0F8C ($Y_min)
    uint16_t window_bottom;      // $7E:0F8E ($Y_max)
    uint16_t window_left;        // $7E:0F90 ($X_min)
    uint16_t window_right;       // $7E:0F92 ($X_max)

    // Cell Attributes & Stride
    uint16_t palette_mask;       // $7E:0FB4
    uint16_t screen_dest_offset; // $7E:0FB6
    uint16_t target_cell_x;      // $7E:0FB8
    uint16_t target_cell_y;      // $7E:0FBA
    uint16_t target_right_edge;  // $7E:0FBE
    uint16_t target_bottom_edge; // $7E:0FC0
    uint16_t vram_dma_trigger;   // $7E:0FC2

    // POI Tracking & Matching
    uint16_t poi_scan_offset;    // $7E:0FCA
    uint16_t poi_offset_x;       // $7E:0FCC
    uint16_t poi_offset_y;       // $7E:0FCE
    uint16_t tile_prop_thresh;   // $7E:0FC8
    uint16_t active_poi_slot_idx;// $7E:0FD0

    // POI Registered Slots
    uint16_t poi_slot_type[MAX_RADAR_POI_SLOTS];   // $7E:0FD2..$7E:0FDC
    uint16_t poi_buffer_offset[MAX_RADAR_POI_SLOTS]; // $7E:1002..$7E:100C
    uint16_t poi_packed_coords[MAX_RADAR_POI_SLOTS]; // $7E:1032..$7E:103C

    // Ring Buffer & Chunk Counters
    int16_t  remaining_chunks;   // $7E:116E
    uint16_t raw_cache_buf[RADAR_WINDOW_CAPACITY / 2]; // $7E:1174
    uint16_t vram_staging_buf[RADAR_WINDOW_CAPACITY / 2]; // $7E:11F4
} MinimapProjectionState;

extern MinimapProjectionState g_minimap_proj;
extern uint16_t g_map_tile_width;  // $7E:08EE
extern uint16_t g_map_tile_height; // $7E:08F0
extern const uint16_t g_field_map_metatiles[65536]; // Bank $7F

/**
 * Clips field map metatiles to the active radar window bounds
 * and formats the output tile buffer with palette attribute bits.
 * Corresponds to $90:A4EC.
 */
void minimap_viewport_clip_and_render(uint16_t *buffer_ptr, uint16_t map_index, uint16_t transparent_key) {
    uint16_t tile = g_field_map_metatiles[map_index];
    if (tile == transparent_key) {
        return;
    }

    uint16_t y = *buffer_ptr;
    g_minimap_proj.raw_cache_buf[y] = tile;

    // 2D Viewport Window Clamping
    if (g_minimap_proj.target_cell_y < g_minimap_proj.window_top ||
        g_minimap_proj.target_cell_y >= g_minimap_proj.window_bottom) {
        return;
    }

    if (g_minimap_proj.target_cell_x < g_minimap_proj.window_left ||
        g_minimap_proj.target_cell_x >= g_minimap_proj.window_right) {
        return;
    }

    // Fuse 5-bit metatile identifier with palette attribute mask
    uint16_t formatted_tile = (g_minimap_proj.target_cell_x & 0x001F) | g_minimap_proj.palette_mask;
    g_minimap_proj.vram_staging_buf[y] = formatted_tile;

    y++;
    if (y >= (RADAR_WINDOW_CAPACITY / 2)) {
        y = 0; // Wrap ring buffer pointer
    }
    *buffer_ptr = y;
    g_minimap_proj.remaining_chunks--;
}

/**
 * Computes screen buffer destination address via hardware multiplication (Y * Stride)
 * and extracts palette attribute bits.
 * Corresponds to $90:A5D0.
 */
void minimap_cell_stride_and_palette_calc(const uint8_t *desc_ptr) {
    g_minimap_proj.target_cell_x = desc_ptr[0];
    g_minimap_proj.target_cell_y = desc_ptr[1];

    uint8_t width = desc_ptr[2];
    uint8_t height = desc_ptr[3];

    // Bounding box edges
    g_minimap_proj.target_right_edge = g_minimap_proj.target_cell_x + width;
    g_minimap_proj.target_bottom_edge = g_minimap_proj.target_cell_y + height;

    // Screen destination offset = (X + Y * Stride) * 2
    uint32_t stride_offset = (uint32_t)g_minimap_proj.target_cell_y * g_map_tile_width;
    g_minimap_proj.screen_dest_offset = (g_minimap_proj.target_cell_x + (uint16_t)stride_offset) * 2;

    // Extract palette attributes: bits 8..12 shifted to bits 5..9
    uint16_t raw_attr = desc_ptr[4] | (desc_ptr[5] << 8);
    g_minimap_proj.palette_mask = (raw_attr & 0x1F00) >> 3;

    // Raise VRAM DMA transfer flag
    g_minimap_proj.vram_dma_trigger = 1;
}

/**
 * Scans POI descriptors, downsamples coordinates 16:1, and registers free tracking slots.
 * Corresponds to $90:A650 - $90:A6EE.
 */
bool minimap_poi_blip_project(const uint16_t *poi_table, uint16_t poi_type) {
    uint16_t idx = g_minimap_proj.poi_scan_offset;
    if (idx == 0) {
        return false;
    }

    uint16_t world_x = poi_table[idx];
    if (world_x == RADAR_SENTINEL_COORD) {
        return false;
    }

    // Downsample coordinates 16:1
    uint16_t radar_x = ((world_x + g_minimap_proj.poi_offset_x) >> 4) & 0x00FF;
    uint16_t radar_y = ((poi_table[idx + 1] + g_minimap_proj.poi_offset_y) >> 4) & 0x00FF;

    // Advance descriptor index
    g_minimap_proj.poi_scan_offset += 2;

    // Validate map bounds
    if (radar_x >= g_map_tile_width || radar_y >= g_map_tile_height) {
        return false;
    }

    // Check map tile property threshold
    uint32_t cell_offset = (radar_x + (radar_y * g_map_tile_width)) * 2;
    uint16_t map_tile = g_field_map_metatiles[cell_offset / 2];
    if (map_tile > g_minimap_proj.tile_prop_thresh) {
        return false;
    }

    // Allocate open tracking slot
    for (int s = 0; s < MAX_RADAR_POI_SLOTS; s++) {
        if (g_minimap_proj.poi_slot_type[s] == 0) {
            g_minimap_proj.poi_slot_type[s] = poi_type;
            g_minimap_proj.poi_packed_coords[s] = radar_x | (radar_y << 8);
            g_minimap_proj.poi_buffer_offset[s] = (uint16_t)cell_offset;
            return true;
        }
    }

    return false; // All 4 POI slots occupied
}
