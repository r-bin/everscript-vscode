/*
 * Routine: $8EAF80 (flight_controller)
 * Bank: $8E (ROM Offset: $0EAF80)
 * Source: docs/disassembly/engine-core/flight-controller.md
 */

#include <stdint.h>
#include <stdbool.h>

#define DPAD_LEFT_RIGHT_MASK    0x0300
#define BANKING_TICK_THRESHOLD  4

typedef struct {
    uint16_t heading_angle;     // $7E:061B
    uint16_t pitch_angle;       // $7E:061D
    uint16_t cruise_speed;      // $7E:0619
} FlightSteeringState;

extern FlightSteeringState g_flight_steering;
extern uint16_t g_controller_pad1; // $7E:0104

extern void play_sound_effect_direct(uint16_t sfx_id);
extern void mode7_flight_frame_engine(int16_t turn_delta, uint16_t vehicle_attr);

/**
 * Evaluates D-pad steering inputs, executes damping inertia division,
 * and updates flight heading and pitch angles.
 * Corresponds to $8E:AF80.
 */
void overworld_flight_controller_steer(int16_t turn_delta) {
    // 1. Calculate candidate heading angle
    uint16_t candidate_heading = (g_flight_steering.heading_angle - turn_delta) & 0x01FF;

    // 2. Test turn differential for banking tick audio
    uint16_t turn_diff = (g_flight_steering.pitch_angle - candidate_heading) & 0x00FF;
    if (turn_diff < BANKING_TICK_THRESHOLD) {
        play_sound_effect_direct(0x0003); // Banking tick sound
    }

    // 3. Process controller turn inputs
    if ((g_controller_pad1 & DPAD_LEFT_RIGHT_MASK) != 0) {
        // Hardware divider simulated damping: delta / 2
        uint16_t smoothed_pitch = turn_delta / 2;
        g_flight_steering.pitch_angle = smoothed_pitch & 0x00FF;
        g_flight_steering.heading_angle = candidate_heading;

        // Cruise speed adjustment during turns
        g_flight_steering.cruise_speed = 0x00FC;
    } else {
        // Return to neutral level flight
        g_flight_steering.pitch_angle = 0;
    }
}
