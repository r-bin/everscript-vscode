/*
 * Routine: $909876 (minimap_radar)
 * Bank: $90 (ROM Offset: $109876)
 * Source: docs/disassembly/ui/minimap-radar.md
 */

#include <stdint.h>
#include <stdbool.h>

#define DOWNSAMPLE_SHIFT 4 // 16:1 world to radar downsampling

typedef struct {
    int16_t world_x;             // $7E:010E
    int16_t world_y;             // $7E:0110
    int16_t prev_radar_x;        // $7E:0F90
    int16_t prev_radar_y;        // $7E:0F8C
    int16_t screen_blip_x;       // $7E:0F92
    int16_t screen_margin_x;     // $7E:0FAC
    uint16_t vram_lock;          // $7E:0F3A
    uint16_t vram_dma_trigger;   // $7E:0FC2
    uint8_t  active_blit_flag;   // DP $B0
} MinimapRadarState;

extern MinimapRadarState g_minimap_radar;
extern uint16_t g_environment_type; // $7E:241F

extern void update_weather_particles(void);
extern void dispatch_map_layer_render(uint16_t env_type);

/**
 * Translates 16-bit world coordinates to 16:1 downsampled radar cells
 * and computes screen blip target coordinates.
 * Corresponds to $90:98FA.
 */
void hud_compass_needle_update(int16_t *out_delta_x, int16_t *out_delta_y) {
    // 1. Downsample World X by 16:1
    int16_t radar_x = g_minimap_radar.world_x >> DOWNSAMPLE_SHIFT;
    *out_delta_x = radar_x - g_minimap_radar.prev_radar_x;
    g_minimap_radar.prev_radar_x = radar_x;

    // Projected screen blip target X
    g_minimap_radar.screen_blip_x = radar_x + g_minimap_radar.screen_margin_x;

    // 2. Downsample World Y by 16:1
    int16_t radar_y = (g_minimap_radar.world_y + 1) >> DOWNSAMPLE_SHIFT;
    *out_delta_y = radar_y - g_minimap_radar.prev_radar_y;
    g_minimap_radar.prev_radar_y = radar_y;
}

/**
 * Safely commits prepared radar tile buffers into VRAM with DMA locking.
 * Corresponds to $90:A4A6.
 */
bool hud_minimap_vram_blit(void) {
    if (g_minimap_radar.active_blit_flag == 0) {
        return false; // No blit requested
    }

    // Lock VRAM transfer queue
    g_minimap_radar.vram_lock++;

    // Increment transfer sequence and queue DMA commit mask
    g_minimap_radar.active_blit_flag++;
    g_minimap_radar.vram_dma_trigger = ((uint16_t)g_minimap_radar.active_blit_flag | 0x0100) >> 1;

    // Unlock VRAM transfer queue
    g_minimap_radar.vram_lock--;

    return true;
}

/**
 * Top-level map overlay, compass needle, and minimap HUD tick.
 * Corresponds to $90:9876.
 */
void render_map_overlay_compass_hud(void) {
    // 1. Weather and ambient particle simulation
    update_weather_particles();

    // 2. Dispatch layer-specific renderer
    dispatch_map_layer_render(g_environment_type);

    // 3. Update compass heading needle and radar position
    int16_t dx, dy;
    hud_compass_needle_update(&dx, &dy);

    // 4. Commit updated radar tiles to VRAM
    hud_minimap_vram_blit();
}
