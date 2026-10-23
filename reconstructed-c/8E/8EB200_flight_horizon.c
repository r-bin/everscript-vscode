/*
 * Routine: $8EB200 (flight_horizon)
 * Bank: $8E (ROM Offset: $0EB200)
 * Source: docs/disassembly/engine-core/flight-horizon.md
 */

#include <stdint.h>
#include <stdbool.h>

extern uint16_t g_flight_camera_altitude;  // $7E:0619
extern uint16_t g_flight_camera_pitch;     // $7E:061B
extern uint16_t g_flight_engine_state;     // $7E:0B29
extern uint16_t g_cockpit_anchor_x;        // $7E:4EF7
extern uint16_t g_cockpit_anchor_y;        // $7E:4EF9

typedef struct FlightEntityNode {
    uint8_t  pad_00[0x5E];
    struct FlightEntityNode *next;         // +0x5E
    uint8_t  pad_60[0x22];
    uint16_t sprite_type;                  // +0x82
} FlightEntityNode;

extern FlightEntityNode *g_flight_entity_head; // $7E:3DDF

extern void minimap_overlay_dispatcher(void);
extern void mode7_flight_pitch_heading_math(void);
extern void update_entity_physics(void);
extern void render_flight_entity_sprite(FlightEntityNode *node);
extern void render_cockpit_occupants(uint16_t x, uint16_t y);

/**
 * Calculates vanishing point horizon pitch tilt from flight elevation delta.
 * Corresponds to $8E:B230.
 */
void mode7_flight_horizon_perspective_math(uint16_t elevation_delta, uint8_t fov_divisor) {
    // 1. Establish base flight camera elevation
    g_flight_camera_altitude = 0x0015;

    // 2. Hardware multiplication: scale elevation delta
    uint16_t scaled_factor = ((elevation_delta >> 8) | 0x0080);
    uint32_t product = (uint32_t)scaled_factor * 0x0080; // Mimicking hardware $4202

    // 3. Perspective hardware division: divide by FOV depth
    uint16_t dividend = (uint16_t)((product << 1) & 0xFFFF);
    if (fov_divisor == 0) fov_divisor = 1;
    uint16_t quotient = dividend / fov_divisor;

    // 4. Subtract vanishing point horizon line baseline (4px)
    g_flight_camera_pitch = quotient - 4;
}

/**
 * Traverses flight entities and renders vehicle cockpit overlay sprites.
 * Corresponds to $8F:C61E.
 */
void mode7_vehicle_cockpit_overlay_sprites(void) {
    // 1. Traverse flight entity linked list
    FlightEntityNode *current = g_flight_entity_head;
    while (current != NULL) {
        render_flight_entity_sprite(current);
        current = current->next;
    }

    // 2. Check if Mode 7 flight is actively running
    if (!(g_flight_engine_state & 0x0001)) {
        return;
    }

    // 3. Render Boy and Dog seated cockpit overlay sprites
    render_cockpit_occupants(g_cockpit_anchor_x, g_cockpit_anchor_y);
}

/**
 * Main coordinator pass for a single Mode 7 flight frame.
 * Corresponds to $8E:B200.
 */
void mode7_flight_frame_coordinator(void) {
    // 1. Update minimap radar blips
    minimap_overlay_dispatcher();

    // 2. Compute pitch and heading delta trigonometry
    mode7_flight_pitch_heading_math();

    // 3. Integrate flight velocity
    update_entity_physics();

    // 4. Render cockpit occupants and flight entities
    mode7_vehicle_cockpit_overlay_sprites();

    // 5. Finalize physics step
    update_entity_physics();
}
