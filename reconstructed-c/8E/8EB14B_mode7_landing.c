/*
 * Routine: $8EB14B (mode7_landing)
 * Bank: $8E (ROM Offset: $0EB14B)
 * Source: docs/disassembly/engine-core/mode7-landing.md
 */

/**
 * @file mode7-landing.c
 * @brief Mode 7 Vehicle Landing Descent, Touchdown & Thrust Climb Engine
 *
 * Source: Secret of Evermore (SNES)
 * Routines: $8E:B14B - $8E:B22F
 */

#include <stdint.h>
#include <stdbool.h>

#define MODE7_ALTITUDE_GROUND_BASELINE  0x0015  /* 21 units */
#define MODE7_ALTITUDE_APPROACH_GLIDE   0x0028  /* 40 units */
#define MODE7_ALTITUDE_CRUISING_LEVEL   0x002A  /* 42 units */
#define MODE7_ALTITUDE_CEILING          0x00FF  /* 255 units max */

#define SFX_ENGINE_THRUST               0x0002
#define MODAL_FLAG_ACTIVE               0x0001

/**
 * @brief Flight Parameter Block referenced by Direct Page $95
 */
typedef struct {
    uint8_t  fov_divisor;           /* +$00: FOV divisor */
    uint8_t  fov_padding;           /* +$01 */
    uint16_t elevation_factor;      /* +$02: Perspective scale */
} FlightParamBlock;

/**
 * @brief Global Mode 7 Overworld Camera & Vehicle State
 */
typedef struct {
    uint16_t camera_altitude;       /* $7E:0619: Flight camera altitude */
    uint16_t camera_pitch;          /* $7E:061B: Horizon perspective pitch */
    uint16_t modal_flags;           /* $7E:05AB: Modal UI active flags */
    const FlightParamBlock *params; /* DP $95: Flight math configuration pointer */
} Mode7FlightState;

/* Subsystem Interfaces */
extern void play_sound_effect_direct(uint16_t sfx_id);              /* $8C:82DC */
extern void sound_queue_callback(uint16_t buffer_id);               /* $90:80D2 */
extern void minimap_overlay_dispatcher(void);                       /* $90:9876 */
extern void mode7_flight_pitch_heading_math(void);                  /* $8E:B33D */
extern void update_entity_physics(void);                            /* $80:96BB */
extern void mode7_vehicle_cockpit_overlay_sprites(void);            /* $8F:C61E */
extern void oam_display_list_finalize(void);                        /* $80:8FEE */
extern void wait_for_nmi_vblank(void);                              /* $80:858C */
extern void mode7_flight_horizon_perspective_math(Mode7FlightState *state); /* $8E:B230 */

/**
 * @brief Executes one synchronous frame tick of the Mode 7 flight pipeline.
 */
static void mode7_flight_frame_tick(const Mode7FlightState *state)
{
    if (state->modal_flags & MODAL_FLAG_ACTIVE) {
        sound_queue_callback(0x0DEB);
        sound_queue_callback(0x0DDB);
    }

    minimap_overlay_dispatcher();
    mode7_flight_pitch_heading_math();
    update_entity_physics();
    mode7_vehicle_cockpit_overlay_sprites();
    update_entity_physics();
    oam_display_list_finalize();
    wait_for_nmi_vblank();
}

/**
 * @brief Approach glide descent step ($8E:B14B - $8E:B19A).
 *
 * Recalculates perspective pitch from FOV and steps altitude down to 40 units.
 */
void mode7_vehicle_landing_descent_step(Mode7FlightState *state)
{
    const FlightParamBlock *params = state->params;
    if (params && params->fov_divisor != 0) {
        uint16_t multiplicand = ((params->elevation_factor & 0x00FF) << 8) | 0x0080;
        uint16_t dividend = (uint16_t)(multiplicand << 1);
        state->camera_pitch = dividend / params->fov_divisor;
    }

    state->camera_altitude = MODE7_ALTITUDE_APPROACH_GLIDE; /* 40 units */
    mode7_flight_frame_tick(state);
    state->camera_altitude = MODE7_ALTITUDE_CRUISING_LEVEL;  /* 42 units */
}

/**
 * @brief Final touchdown descent to ground baseline ($8E:B19B - $8E:B1D9).
 *
 * Lowers altitude to ground baseline 21 units and lowers pitch by 4 units.
 */
void mode7_vehicle_landing_touchdown_stepper(Mode7FlightState *state)
{
    state->camera_altitude = MODE7_ALTITUDE_GROUND_BASELINE; /* 21 units */
    state->camera_pitch = (uint16_t)(state->camera_pitch - 4);

    mode7_flight_frame_tick(state);
}

/**
 * @brief Accelerated ascent climb loop until altitude ceiling ($8E:B1DA - $8E:B22F).
 *
 * Plays thrust sound and increases altitude (+10) and pitch (+4) per frame until ceiling.
 */
void mode7_vehicle_ascent_takeoff_loop(Mode7FlightState *state)
{
    play_sound_effect_direct(SFX_ENGINE_THRUST);

    while (state->camera_altitude < MODE7_ALTITUDE_CEILING) {
        uint16_t next_alt = state->camera_altitude + 10;
        if (next_alt >= MODE7_ALTITUDE_CEILING) {
            break;
        }
        state->camera_altitude = next_alt;
        state->camera_pitch = (uint16_t)((state->camera_pitch + 4) & 0x00FF);

        mode7_flight_frame_tick(state);
    }

    /* Branch to level flight baseline settling */
    mode7_flight_horizon_perspective_math(state);
}
