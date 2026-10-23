/*
 * Routine: $809DF8 (weather_physics)
 * Bank: $80 (ROM Offset: $009DF8)
 * Source: docs/disassembly/engine-core/weather-physics.md
 */

#include <stdint.h>
#include <stdbool.h>

#define MAX_WEATHER_PARTICLES 16
#define SCREEN_WIDTH_MASK     0x00FF

typedef struct {
    uint16_t x;                 // Screen horizontal coordinate
    uint16_t y;                 // Screen vertical coordinate
} WeatherParticleCoord;

typedef struct {
    uint16_t phase_timer;       // Splash countdown / state timer
    uint16_t sprite_tile;       // Active display sprite tile
} WeatherParticleState;

typedef struct {
    int16_t  wind_base_x;       // $7E:72D1: Baseline horizontal drift
    uint16_t fall_speed_y;      // $7E:72D3: Baseline vertical fall speed
    uint16_t sway_amplitude;    // $7E:72D5: Oscillation sway amplitude
    uint16_t sway_frequency;    // $7E:72D7: Angular velocity increment
    uint16_t spawn_x_min;       // $7E:72D9: Left spawn bound
    uint16_t spawn_x_max;       // $7E:72DB: Right spawn bound
    uint16_t spawn_y_min;       // $7E:72DD: Top spawn bound
    uint16_t ground_wrap_y;     // $7E:72DF: Ground impact / wrap scanline
    uint16_t oam_sprite_base;   // $7E:72E1: Primary particle sprite tile
    uint8_t  padding[0x2E];
    uint16_t splash_tile_base;  // $7E:7311: Splash animation start tile (0 = no splash)
} WeatherConfigBlock;

// WRAM Globals
#define WRAM_WEATHER_CONFIG   ((volatile WeatherConfigBlock*)0x7E72D1)
#define WRAM_WEATHER_MODE     (*(volatile uint16_t*)0x7E2439)
#define WRAM_PARTICLE_COORDS  ((volatile WeatherParticleCoord*)0x7E2440)
#define WRAM_PARTICLE_STATES  ((volatile WeatherParticleState*)0x7E2480)
#define WRAM_ENV_TICK_SEED    (*(volatile uint16_t*)0x7E0134)

// External Tables & Subroutines
extern const int8_t  s_sine_table_256[256];                   // $80:8800
extern uint16_t      get_random_number(void);                 // $80:859B

/**
 * $80:9E51 - Handles particle ground impact, splash droplet animation, and recycling.
 */
void weather_particle_splash_and_recycle(int index) {
    volatile WeatherConfigBlock *cfg = WRAM_WEATHER_CONFIG;
    volatile WeatherParticleCoord *coord = &WRAM_PARTICLE_COORDS[index];
    volatile WeatherParticleState *state = &WRAM_PARTICLE_STATES[index];

    // If preset defines a splash tile, initiate 3-frame splash animation
    if (cfg->splash_tile_base != 0) {
        state->phase_timer = 3;
        state->sprite_tile = cfg->splash_tile_base;
    } else {
        // Immediate wrap without splash: reset to top spawn bound
        coord->y = cfg->spawn_y_min;
        
        // Randomize horizontal spawn within bounded window
        uint16_t span = cfg->spawn_x_max - cfg->spawn_x_min;
        if (span == 0) span = 256;
        coord->x = cfg->spawn_x_min + (get_random_number() % span);
        state->phase_timer = 0;
        state->sprite_tile = cfg->oam_sprite_base;
    }
}

/**
 * Updates an active ground splash animation frame.
 */
static void weather_particle_splash_tick(int index) {
    volatile WeatherParticleState *state = &WRAM_PARTICLE_STATES[index];

    if (state->phase_timer > 0) {
        state->phase_timer--;
        if (state->phase_timer == 0) {
            // Splash sequence ended: recycle particle to top
            weather_particle_splash_and_recycle(index);
        } else {
            // Advance to next splash keyframe
            state->sprite_tile++;
        }
    }
}

/**
 * $80:9DF8 - Simulates weather particle physics with wind oscillation and impact.
 */
void weather_particle_generator_and_acceleration(void) {
    if (WRAM_WEATHER_MODE == 0) {
        return; // Clear weather: no particles
    }

    volatile WeatherConfigBlock *cfg = WRAM_WEATHER_CONFIG;

    // Advance dynamic wind sway oscillation angle
    WRAM_ENV_TICK_SEED = (WRAM_ENV_TICK_SEED + cfg->sway_frequency) & 0x00FF;
    uint8_t angle = (uint8_t)WRAM_ENV_TICK_SEED;

    // Calculate sway perturbation via hardware sine lookup
    int16_t sine_val = s_sine_table_256[angle];
    int16_t sway_delta = (int16_t)(((int32_t)sine_val * (int32_t)cfg->sway_amplitude) >> 8);

    // Update all 16 active particle slots
    for (int i = 0; i < MAX_WEATHER_PARTICLES; i++) {
        volatile WeatherParticleCoord *coord = &WRAM_PARTICLE_COORDS[i];
        volatile WeatherParticleState *state = &WRAM_PARTICLE_STATES[i];

        if (state->phase_timer > 0) {
            weather_particle_splash_tick(i);
            continue;
        }

        // Integrate downward velocity
        coord->y += cfg->fall_speed_y;

        // Check if particle hit ground threshold
        if (coord->y >= cfg->ground_wrap_y) {
            weather_particle_splash_and_recycle(i);
        } else {
            // Integrate horizontal drift with dynamic wind sway
            coord->x = (coord->x + cfg->wind_base_x + sway_delta) & SCREEN_WIDTH_MASK;
        }
    }
}
