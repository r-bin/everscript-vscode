/*
 * Routine: $909545 (viewport_culling)
 * Bank: $90 (ROM Offset: $109545)
 * Source: docs/disassembly/engine-core/viewport-culling.md
 */

#include <stdint.h>
#include <stdbool.h>

typedef struct {
    int16_t min_x;   // $7E:0F48
    int16_t min_y;   // $7E:0F4A
    int16_t max_x;   // $7E:0F4C
    int16_t max_y;   // $7E:0F4E
} ViewportFrustum;

typedef struct {
    uint8_t  pad0[3];
    uint8_t  origin_y;       // +0x03
    uint8_t  pad1[4];
    uint8_t  origin_x;       // +0x08
} EntityAnchor;

typedef struct {
    uint16_t buffer_offset;  // DP $56
    uint16_t pixel_rem_x;    // DP $66
    uint16_t pixel_rem_y;    // DP $68
    uint16_t tile_attribute; // DP $50
} ProjectedScreenTile;

extern ViewportFrustum g_camera_frustum;      // $7E:0F48..0F4E
extern uint16_t g_vram_row_stride_base;       // $7E:08EE
extern const uint16_t g_screen_buffer_7f[];   // $7F:0004

extern void dispatch_tile_contact_shadow(ProjectedScreenTile *proj);

/**
 * Checks if entity world coordinates fall within camera viewport bounds.
 * Corresponds to $90:9545.
 * Returns true if visible, false if culled.
 */
bool camera_frustum_cull_test(int16_t world_x, int16_t world_y) {
    if (world_y < g_camera_frustum.min_y || world_y >= g_camera_frustum.max_y) {
        return false; // Vertical cull
    }
    if (world_x < g_camera_frustum.min_x || world_x >= g_camera_frustum.max_x) {
        return false; // Horizontal cull
    }
    return true; // Inside frustum
}

/**
 * Projects entity world coordinates into screen tile coordinates,
 * determines buffer offset into $7F:0004, and queues contact shadow.
 * Corresponds to $90:9561.
 */
bool entity_screen_tile_projection(EntityAnchor *entity, int16_t world_x, int16_t world_y, ProjectedScreenTile *out_proj) {
    // 1. Frustum visibility check
    if (!camera_frustum_cull_test(world_x, world_y)) {
        return false;
    }

    // 2. Tile row calculation
    int16_t rel_y = world_y - entity->origin_y;
    uint16_t tile_row = ((uint16_t)rel_y >> 3) & 0xFE;
    uint32_t row_stride = (tile_row << 8) | g_vram_row_stride_base;

    // 3. Tile column calculation
    int16_t rel_x = world_x - entity->origin_x;
    uint16_t tile_col = (((uint16_t)rel_x >> 3) - 1) & 0xFE;

    // 4. Screen buffer address ($7F:0004 + offset)
    uint16_t buffer_offset = (uint16_t)(row_stride + tile_col);
    out_proj->buffer_offset = buffer_offset;

    // 5. Pixel fine offsets (0..15 remainder)
    out_proj->pixel_rem_y = (rel_y & 0x0F) + 6;
    out_proj->pixel_rem_x = (rel_x & 0x0F) + 16;

    // 6. Read tile attribute and dispatch contact shadow hook
    out_proj->tile_attribute = g_screen_buffer_7f[buffer_offset >> 1];
    dispatch_tile_contact_shadow(out_proj);

    return true;
}
