/*
 * WARNING / HALLUCINATION NOTICE:
 * This C reconstruction does NOT match the ROM assembly at $80:A305!
 * In the authentic ROM, $80:A305 is an unrolled sequential parameter copy from [$AA],y
 * into $7E:72DB..$7E:72EB (weather preset / graphic staging buffer at $7E:72D1).
 * The particle simulation loop below with variables $7E:2439, $7E:243B, $7E:243D, and
 * $7E:2440 is an AI hallucination from commit 2bdcbb93 and MUST BE RECHECKED and rewritten.
 *
 * Routine: $80A305 (NEEDS RECHECK - UNVERIFIED / FABRICATED)
 * Bank: $80 (ROM Offset: $00A305)
 * Source: docs/disassembly/engine-core/weather-particles.md
 */

#include <stdint.h>
#include <stdbool.h>

#define MAX_WEATHER_PARTICLES 16
#define SCREEN_HEIGHT_SCANLINES 224 // 0x00E0 SNES active display height
#define SCREEN_WIDTH_PIXELS 256     // 0x0100

typedef struct {
    uint16_t x;
    uint16_t y;
} WeatherParticle;

extern WeatherParticle g_weather_particles[MAX_WEATHER_PARTICLES]; // $7E:2440
extern uint16_t g_weather_mode;         // $7E:2439
extern int16_t  g_weather_wind_drift;   // $7E:243B
extern uint16_t g_weather_down_speed;   // $7E:243D

extern uint16_t get_random_number(void); // $80:859B

/**
 * Simulates falling weather particles (rain, embers, snow) and wraps across screen boundaries.
 * Corresponds to $80:A305.
 */
void weather_particle_simulation_loop(void) {
    if (g_weather_mode == 0) {
        return; // Clear weather
    }

    for (int i = 0; i < MAX_WEATHER_PARTICLES; i++) {
        WeatherParticle *p = &g_weather_particles[i];

        // Downward velocity integration
        uint16_t new_y = p->y + g_weather_down_speed;

        if (new_y >= SCREEN_HEIGHT_SCANLINES) {
            // Reached bottom of screen: wrap to top with randomized X coordinate
            p->y = 0;
            p->x = get_random_number() & 0x00FF;
        } else {
            // Integrate wind drift and update coordinates
            p->y = new_y;
            p->x = (p->x + g_weather_wind_drift) & 0x00FF;
        }
    }
}
