/*
 * Routine: $80A100 (screen_effects)
 * Bank: $80 (ROM Offset: $00A100)
 * Source: docs/disassembly/engine-core/screen-effects.md
 */

#include <stdint.h>
#include <stdbool.h>

#define CGRAM_NUM_COLORS        256
#define PALETTE_CHUNK_SIZE      16

typedef struct {
    uint16_t cgram_shadow[CGRAM_NUM_COLORS]; /* $7E:7300..$7E:74FF */
    uint16_t shake_intensity;                /* $7E:2435 */
    int16_t  shake_offset_y;                 /* $7E:2437 */
    uint8_t  flash_timer;
    uint16_t flash_color;
} VisualEffectsState;

/**
 * Commits a 16-color palette block into the WRAM CGRAM shadow buffer.
 * Corresponds to native routines $80:A100 and $80:A16E.
 */
void palette_commit_16color_chunk(VisualEffectsState *vfx, uint8_t palette_index, const uint16_t *source_colors) {
    if (palette_index >= 16) {
        return;
    }

    uint16_t base_offset = palette_index * PALETTE_CHUNK_SIZE;
    for (int i = 0; i < PALETTE_CHUNK_SIZE; i++) {
        vfx->cgram_shadow[base_offset + i] = source_colors[i];
    }
}

/**
 * Updates the screen shake oscillation and decays tremor intensity.
 * Corresponds to native routine $80:A2E0.
 */
void screen_shake_tick(VisualEffectsState *vfx) {
    if (vfx->shake_intensity == 0) {
        vfx->shake_offset_y = 0;
        return;
    }

    /* Decrement tremor countdown */
    vfx->shake_intensity--;

    /* Compute oscillating vertical offset (+/- amplitude based on frame parity) */
    int16_t amplitude = (int16_t)(vfx->shake_intensity & 0x03);
    if ((vfx->shake_intensity & 0x01) != 0) {
        vfx->shake_offset_y = amplitude;
    } else {
        vfx->shake_offset_y = -amplitude;
    }
}

/**
 * Triggers a damage screen flash (e.g. red tint when player takes severe damage).
 */
void screen_flash_trigger(VisualEffectsState *vfx, uint16_t bgr555_color, uint8_t duration_frames) {
    vfx->flash_color = bgr555_color;
    vfx->flash_timer = duration_frames;
}
