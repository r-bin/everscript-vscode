/*
 * Routine: $8EB268 (mode7_takeoff)
 * Bank: $8E (ROM Offset: $0EB268)
 * Source: docs/disassembly/engine-core/mode7-takeoff.md
 */

/**
 * @file mode7-takeoff.c
 * @brief Mode 7 Vehicle Takeoff Stepped Altitude Coordinator & Perspective Calculator
 *
 * Source: Secret of Evermore (SNES)
 * Routine: $8E:B268 - $8E:B33C
 */

#include <stdint.h>
#include <stdbool.h>

/* Altitude Step Constants */
#define MODE7_ALTITUDE_STAGE_LIFTOFF   0x0015  /* 21 units: initial liftoff */
#define MODE7_ALTITUDE_STAGE_CLIMB     0x002A  /* 42 units: primary climb */
#define MODE7_ALTITUDE_STAGE_CREST     0x002C  /* 44 units: aerodynamic over-rise crest */
#define MODE7_ALTITUDE_CRUISING        0x002A  /* 42 units: steady cruise level */

/* Modal Dialog Flags ($7E:05AB) */
#define MODAL_FLAG_ACTIVE              0x0001

/**
 * @brief Flight Parameter Block referenced by Direct Page $95
 */
typedef struct {
    uint8_t  fov_divisor;           /* +$00: FOV divisor for hardware divider */
    uint8_t  fov_padding;           /* +$01 */
    uint16_t elevation_factor;      /* +$02: Elevation perspective scale factor */
} FlightParamBlock;

/**
 * @brief Global Mode 7 Overworld Camera & Vehicle State
 */
typedef struct {
    uint16_t camera_altitude;       /* $7E:0619: Flight camera altitude */
    uint16_t camera_pitch;          /* $7E:061B: Vanishing point perspective pitch */
    uint16_t modal_flags;           /* $7E:05AB: Modal UI active flags */
    const FlightParamBlock *params; /* DP $95: Flight math configuration pointer */
} Mode7FlightState;

/* External Subsystem Interface Prototypes */
extern void sound_queue_callback(uint16_t buffer_id);               /* $90:80D2 */
extern void minimap_overlay_dispatcher(void);                       /* $90:9876 */
extern void mode7_flight_pitch_heading_math(void);                  /* $8E:B33D */
extern void update_entity_physics(void);                            /* $80:96BB */
extern void mode7_vehicle_cockpit_overlay_sprites(void);            /* $8F:C61E */
extern void oam_display_list_finalize(void);                        /* $80:8FEE */
extern void wait_for_nmi_vblank(void);                              /* $80:858C */

/**
 * @brief Executes one synchronous frame tick of the Mode 7 flight pipeline.
 *
 * @param state Pointer to active flight state
 */
static void mode7_flight_frame_tick(const Mode7FlightState *state)
{
    /* 1. Modal Dialogue & Sound Queue Management */
    if (state->modal_flags & MODAL_FLAG_ACTIVE) {
        sound_queue_callback(0x0DEB);
        sound_queue_callback(0x0DDB);
    }

    /* 2. Minimap Blip Overlay */
    minimap_overlay_dispatcher();

    /* 3. Heading & Direction Trigonometric Integration */
    mode7_flight_pitch_heading_math();

    /* 4. Entity Physics Simulation (Pass 1) */
    update_entity_physics();

    /* 5. Seated Occupants Cockpit Sprite Compositor */
    mode7_vehicle_cockpit_overlay_sprites();

    /* 6. Entity Physics Simulation (Pass 2) */
    update_entity_physics();

    /* 7. Finalize OAM Display List & Wait for VBLANK */
    oam_display_list_finalize();
    wait_for_nmi_vblank();
}

/**
 * @brief Recalculates the horizon vanishing point pitch tilt using SNES hardware math.
 *
 * Models 65816 routine $8E:B2A0 - $8E:B2C9.
 *
 * @param state Pointer to active flight state
 */
static void mode7_recalculate_pitch_math(Mode7FlightState *state)
{
    const FlightParamBlock *params = state->params;
    if (!params || params->fov_divisor == 0) {
        return;
    }

    /* 65816: LDA $0002,y; XBA; ORA #$0080; STA $4202 (Hardware Multiplier) */
    uint16_t multiplicand = ((params->elevation_factor & 0x00FF) << 8) | 0x0080;
    
    /* Hardware multiplier produces 16-bit product */
    uint16_t product = multiplicand; /* in SNES hardware: multiplied against fixed 8-bit factor */
    
    /* 65816: ASL A; STA $4204 (Hardware Dividend) */
    uint16_t dividend = (uint16_t)(product << 1);

    /* 65816: STA $4206 (Hardware Divisor); NOP; LDA $4214 (Hardware Quotient) */
    uint16_t quotient = dividend / params->fov_divisor;

    /* Store quotient into camera pitch vanishing point register */
    state->camera_pitch = quotient;
}

/**
 * @brief Multi-stage takeoff elevation climb sequence ($8E:B268 - $8E:B33C).
 *
 * Steps camera altitude through liftoff, climb, and crest plateaus,
 * recalculating perspective matrix pitch tilt and synchronizing frame ticks.
 *
 * @param state Pointer to global Mode 7 flight state
 */
void mode7_vehicle_takeoff_altitude_stepper(Mode7FlightState *state)
{
    /* --- Stage 1: Liftoff Frame Synchronization --- */
    mode7_flight_frame_tick(state);

    /* --- Stage 2: Climb Step & Perspective Pitch Calculation --- */
    state->camera_altitude = MODE7_ALTITUDE_STAGE_CLIMB; /* 0x002A (42) */
    mode7_recalculate_pitch_math(state);
    mode7_flight_frame_tick(state);

    /* --- Stage 3: Aerodynamic Over-Rise Crest --- */
    state->camera_altitude = MODE7_ALTITUDE_STAGE_CREST; /* 0x002C (44) */
    mode7_flight_frame_tick(state);

    /* --- Final Settlement: Steady Cruising Altitude --- */
    state->camera_altitude = MODE7_ALTITUDE_CRUISING;    /* 0x002A (42) */
}
