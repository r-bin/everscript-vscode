/*
 * Routine: $809E93 (weather_palette)
 * Bank: $80 (ROM Offset: $009E93)
 * Source: docs/disassembly/engine-core/weather-palette.md
 */

#include <stdint.h>
#include <stdbool.h>

#define PALETTE_CYCLE_BUF_1         0x7E7321
#define PALETTE_CYCLE_BUF_2         0x7E7331

#define WRAM_SHAKE_ACTIVE_FLAG      0x00C3
#define WRAM_SHAKE_INTENSITY        0x2435
#define WRAM_SHAKE_OFFSET_Y         0x2437

#define NUM_WEATHER_PARTICLES       16

typedef struct {
    int16_t x;
    int16_t y;
    int8_t  vx;
    int8_t  vy;
    uint8_t life;
} WeatherParticle;

typedef struct {
    uint8_t  timer;
    uint8_t  period;
    uint8_t  current_step;
    uint8_t  num_steps;
    uint16_t colors[8];
} PaletteCycleGroup;

/**
 * Updates a 4-color animated palette cycle gradient ($80:9E93 / $80:A003).
 *
 * @param group   Palette cycling timing and color definition.
 * @param buf_idx 1 for buffer $7E:7321, 2 for buffer $7E:7331.
 */
void update_palette_cycle(PaletteCycleGroup *group, int buf_idx) {
    if (++group->timer < group->period) {
        return;
    }
    group->timer = 0;

    // Advance rotation step
    group->current_step = (group->current_step + 1) % group->num_steps;

    uint32_t base_addr = (buf_idx == 1) ? PALETTE_CYCLE_BUF_1 : PALETTE_CYCLE_BUF_2;

    // Write 4 rotated 16-bit BGR555 words into CGRAM shadow buffer
    for (int i = 0; i < 4; i++) {
        uint8_t color_idx = (group->current_step + i) % group->num_steps;
        uint16_t color = group->colors[color_idx];
        write_wram16(base_addr + (i * 2), color);
    }

    // Flag VBLANK CGRAM upload required
    mark_cgram_dma_pending();
}

/**
 * Decays screen shake timer and generates displacement jitter ($80:A2E0).
 *
 * @return Signed Y displacement offset (-4..+3 pixels) applied to camera.
 */
int16_t update_screen_shake(void) {
    uint8_t active = read_wram8(WRAM_SHAKE_ACTIVE_FLAG);
    if (!active) {
        return 0;
    }

    uint16_t intensity = read_wram16(WRAM_SHAKE_INTENSITY);
    if (intensity == 0) {
        write_wram8(WRAM_SHAKE_ACTIVE_FLAG, 0);
        write_wram16(WRAM_SHAKE_OFFSET_Y, 0);
        return 0;
    }

    // Decay intensity
    intensity--;
    write_wram16(WRAM_SHAKE_INTENSITY, intensity);

    if (intensity == 0) {
        write_wram8(WRAM_SHAKE_ACTIVE_FLAG, 0);
        write_wram16(WRAM_SHAKE_OFFSET_Y, 0);
        return 0;
    }

    // Generate random jitter offset within current intensity bounds
    int16_t rng = (int16_t)(snes_rng_next() & 0x07); // 0..7
    int16_t jitter_y = rng - 3;                       // -3..+4

    write_wram16(WRAM_SHAKE_OFFSET_Y, (uint16_t)jitter_y);
    return jitter_y;
}

/**
 * Simulates weather precipitation particles (rain, snow, embers) ($80:A2E0).
 *
 * @param particles Particle array in WRAM.
 * @param count     Number of active particles.
 * @param view_w    Viewport width in pixels.
 * @param view_h    Viewport height in pixels.
 */
void update_weather_particles(WeatherParticle *particles, int count, int16_t view_w, int16_t view_h) {
    for (int i = 0; i < count; i++) {
        WeatherParticle *p = &particles[i];

        p->x += p->vx;
        p->y += p->vy;

        // Wrap around screen boundaries
        if (p->y > view_h) {
            p->y = 0;
            p->x = (int16_t)(snes_rng_next() % view_w);
        }
        if (p->x > view_w) {
            p->x = 0;
        } else if (p->x < 0) {
            p->x = view_w;
        }
    }
}
