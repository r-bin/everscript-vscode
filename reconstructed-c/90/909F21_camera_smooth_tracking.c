/*
 * Routine: $909F21 (camera_smooth_tracking)
 * Bank: $90 (ROM Offset: $109F21)
 * Source: docs/disassembly/engine-core/camera-smooth-tracking.md
 */

#include "engine-core/camera-smooth-tracking.h"
#include <stdint.h>

// ----------------------------------------------------------------------------
// Global Registers & Viewport Bounds
// ----------------------------------------------------------------------------
extern int16_t  g_camera_origin_x;          // DP $00BF
extern int16_t  g_camera_origin_y;          // DP $00C1
extern int16_t  g_prev_camera_x;            // DP $0012
extern int16_t  g_prev_camera_y;            // DP $0014

extern uint16_t g_camera_velocity_config;   // $7E:242F (High: whole pixels, Low: sub-pixel rate)
extern uint16_t g_camera_subpixel_acc;      // $7E:0F38 (0..15 fractional carry)

extern int16_t  g_screen_shake_offset_x;    // DP $00C5
extern int16_t  g_screen_shake_offset_y;    // DP $00C7

extern uint16_t g_viewport_bound_left;      // $7E:2401 (X_min)
extern uint16_t g_viewport_bound_right;     // $7E:2403 (X_max = X_min + 256)
extern uint16_t g_viewport_bound_top;       // $7E:2405 (Y_min)
extern uint16_t g_viewport_bound_bottom;    // $7E:2407 (Y_max = Y_min + 224)

#define VIEWPORT_WIDTH   256
#define VIEWPORT_HEIGHT  224

/**
 * camera_smooth_tracking_filter_and_screen_bounds ($90:9F21 – $90:9FC8)
 *
 * Applies fractional sub-pixel velocity rate-limiting to candidate camera
 * coordinates (DP $BF, $C1), superimposes screen shake displacements, and
 * commits the active 256x224 frustum bounding box.
 */
void camera_smooth_tracking_filter_and_screen_bounds(void) {
    // 1. Calculate maximum allowable panning distance for current frame
    uint16_t max_speed = g_camera_velocity_config >> 4;
    uint16_t sub_rate  = g_camera_velocity_config & 0x000F;

    uint16_t sub_acc = g_camera_subpixel_acc + sub_rate;
    if (sub_acc & 0xFFF0) {
        max_speed++; // Fractional overflow adds 1 whole pixel
    }
    g_camera_subpixel_acc = sub_acc & 0x000F;

    // 2. Horizontal Velocity Clamping
    int16_t dx = g_camera_origin_x - g_prev_camera_x;
    if (dx != 0) {
        if (dx > 0) {
            if ((uint16_t)(dx - 1) >= max_speed) {
                g_camera_origin_x = g_prev_camera_x + max_speed;
            }
        } else {
            uint16_t abs_dx = (uint16_t)(-dx);
            if (abs_dx >= max_speed) {
                g_camera_origin_x = g_prev_camera_x - max_speed;
            }
        }
    }

    // 3. Vertical Velocity Clamping
    int16_t dy = g_camera_origin_y - g_prev_camera_y;
    if (dy != 0) {
        if (dy > 0) {
            if ((uint16_t)(dy - 1) >= max_speed) {
                g_camera_origin_y = g_prev_camera_y + max_speed;
            }
        } else {
            uint16_t abs_dy = (uint16_t)(-dy);
            if (abs_dy >= max_speed) {
                g_camera_origin_y = g_prev_camera_y - max_speed;
            }
        }
    }

    // 4. Apply Screen Shake Displacements with Underflow Clamping ($90:9F8B)
    int16_t final_x = g_camera_origin_x + g_screen_shake_offset_x;
    if (final_x < 0) {
        final_x = 0;
    }
    g_camera_origin_x = final_x;

    int16_t final_y = g_camera_origin_y + g_screen_shake_offset_y;
    if (final_y < 0) {
        final_y = 0;
    }
    g_camera_origin_y = final_y;

    // 5. Commit Active Frustum Culling Bounding Box
    g_viewport_bound_left   = (uint16_t)final_x;
    g_viewport_bound_right  = (uint16_t)(final_x + VIEWPORT_WIDTH);
    g_viewport_bound_top    = (uint16_t)final_y;
    g_viewport_bound_bottom = (uint16_t)(final_y + VIEWPORT_HEIGHT);
}
