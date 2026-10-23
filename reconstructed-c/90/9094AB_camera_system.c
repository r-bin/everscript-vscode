/*
 * Routine: $9094AB (camera_system)
 * Bank: $90 (ROM Offset: $1094AB)
 * Source: docs/disassembly/engine-core/camera-system.md
 */

#include <stdint.h>
#include <stdbool.h>

#define SCREEN_WIDTH        256
#define SCREEN_HEIGHT       224
#define HALF_SCREEN_WIDTH   128
#define HALF_SCREEN_HEIGHT  112

typedef struct {
    uint16_t vram_lock;      // $7E:0F3A: VRAM upload safety lock
    uint16_t tracked_entity; // $7E:0F42: Pointer to entity record
    uint16_t min_x;          // $7E:23E9: Room left margin
    uint16_t min_y;          // $7E:23EB: Room top margin
    uint16_t max_x;          // $7E:23ED: Room right margin
    uint16_t max_y;          // $7E:23EF: Room bottom margin
    int16_t  fixed_target_x; // $7E:242B: Fixed anchor X (-1 = follow entity)
    int16_t  fixed_target_y; // $7E:242D: Fixed anchor Y (-1 = follow entity)
    uint16_t scroll_mode;    // $7E:241F: Metatile update pattern
    uint16_t camera_x;       // DP $BF / $59
    uint16_t camera_y;       // DP $C1 / $5B
} CameraSystemContext;

extern CameraSystemContext g_camera;
extern const uint8_t       g_wram[0x20000];

extern void update_bg_tile_stream(uint16_t x, uint16_t y);

/**
 * Calculates camera focus point, centers the viewport, and clamps to room boundaries.
 * Corresponds to $90:94AB.
 */
void camera_center_and_clamp(void) {
    uint16_t center_x;
    uint16_t center_y;

    // 1. Determine Target Center Position
    if (g_camera.fixed_target_x >= 0) {
        // Fixed Anchor Cutscene Target
        center_x = (uint16_t)g_camera.fixed_target_x + HALF_SCREEN_WIDTH;
        center_y = (uint16_t)g_camera.fixed_target_y + HALF_SCREEN_HEIGHT;
    } else {
        // Tracked Entity Target (Boy or Dog)
        uint16_t entity_addr = g_camera.tracked_entity;
        center_x = *(const uint16_t *)&g_wram[entity_addr + 0x1A];
        center_y = *(const uint16_t *)&g_wram[entity_addr + 0x1C];
    }

    // 2. Lock VRAM Updates during camera repositioning
    g_camera.vram_lock++;

    // 3. Compute Top-Left Viewport Origin and Clamp X
    int32_t view_x = (int32_t)center_x - HALF_SCREEN_WIDTH;
    if (view_x < (int32_t)g_camera.min_x) {
        view_x = g_camera.min_x;
    } else if (view_x + SCREEN_WIDTH > (int32_t)g_camera.max_x) {
        view_x = (int32_t)g_camera.max_x - SCREEN_WIDTH;
    }
    g_camera.camera_x = (uint16_t)view_x;

    // 4. Compute Top-Left Viewport Origin and Clamp Y
    int32_t view_y = (int32_t)center_y - HALF_SCREEN_HEIGHT;
    if (view_y < (int32_t)g_camera.min_y) {
        view_y = g_camera.min_y;
    } else if (view_y + SCREEN_HEIGHT > (int32_t)g_camera.max_y) {
        view_y = (int32_t)g_camera.max_y - SCREEN_HEIGHT;
    }
    g_camera.camera_y = (uint16_t)view_y;

    // 5. Update Background Tile Streaming Rows/Columns
    update_bg_tile_stream(g_camera.camera_x, g_camera.camera_y);

    // 6. Unlock VRAM Updates
    g_camera.vram_lock--;
}
