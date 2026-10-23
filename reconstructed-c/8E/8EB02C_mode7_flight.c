/*
 * Routine: $8EB02C (mode7_flight)
 * Bank: $8E (ROM Offset: $0EB02C)
 * Source: docs/disassembly/engine-core/mode7-flight.md
 */

#include <stdint.h>
#include <stdbool.h>

#define ANGLE_STEPS         512
#define ANGLE_MASK          (ANGLE_STEPS - 1)
#define COSINE_OFFSET       128 // 90 degrees in 512-step circle

typedef struct {
    int16_t  world_x;        // $7E:0615
    int16_t  world_y;        // $7E:0617
    uint16_t elevation;      // $7E:0619 (speed & altitude factor)
    uint16_t heading_angle;  // $7E:061B (0..511 steps)
    uint16_t quotient;       // $7E:061D
    uint16_t flags;          // $7E:05AB
} Mode7FlightState;

extern Mode7FlightState g_flight_state;
extern int16_t g_camera_shadow_x;  // DP $59
extern int16_t g_camera_shadow_y;  // DP $5B

// 512-entry signed 16-bit sine lookup table ($80:88A3)
extern const int16_t g_sine_table[ANGLE_STEPS];

extern void direct_sprite_draw_oam(int16_t screen_x, int16_t screen_y, uint16_t attr, uint32_t sprite_record);
extern void update_entity_physics(void);
extern void setup_mode7_hdma(void);

/**
 * Calculates forward flight motion using 512-step sine/cosine trigonometry.
 * Corresponds to $8E:B33D.
 */
void mode7_flight_pitch_heading_math(int16_t turn_delta) {
    // 1. Update and wrap heading angle (0..511)
    uint16_t angle = (g_flight_state.heading_angle - turn_delta) & ANGLE_MASK;
    g_flight_state.heading_angle = angle;

    // 2. Read sine and cosine from trigonometric table
    int16_t sin_val = g_sine_table[angle];
    int16_t cos_val = g_sine_table[(angle + COSINE_OFFSET) & ANGLE_MASK];

    // 3. Scale velocity by altitude / speed factor
    uint32_t speed = g_flight_state.elevation;
    int16_t delta_x = (int16_t)(((int32_t)sin_val * speed) >> 8);
    int16_t delta_y = (int16_t)(((int32_t)cos_val * speed) >> 8);

    // 4. Integrate flight world position
    g_flight_state.world_x -= delta_x;
    g_flight_state.world_y += delta_y;
}

/**
 * Projects the vehicle sprite onto the Mode 7 perspective viewport.
 * Corresponds to $8E:B520.
 */
void mode7_flight_sprite_render(uint16_t vehicle_attr) {
    // Screen X = World X - Camera Shadow X
    int16_t screen_x = g_flight_state.world_x - g_camera_shadow_x;

    // Perspective elevation vertical tilt adjustment: (elevation * 3) >> 2
    int16_t elev_tilt = (int16_t)((g_flight_state.elevation * 3) >> 2);

    // Screen Y = World Y - Elevation Tilt - Camera Shadow Y
    int16_t screen_y = g_flight_state.world_y - elev_tilt - g_camera_shadow_y;

    // Render vehicle sprite (descriptor at $CC:32C9)
    direct_sprite_draw_oam(screen_x, screen_y, vehicle_attr, 0xCC32C9);
}

/**
 * Executes one frame of overworld Mode 7 flight simulation.
 * Corresponds to $8E:B02C.
 */
void mode7_flight_frame_engine(int16_t turn_delta, uint16_t vehicle_attr) {
    // 1. Project Windwalker sprite
    mode7_flight_sprite_render(vehicle_attr);

    // 2. Trigonometric heading & velocity integration
    mode7_flight_pitch_heading_math(turn_delta);

    // 3. Subsystem physics and HDMA gradient refresh
    update_entity_physics();
    setup_mode7_hdma();
}
