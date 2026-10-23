/*
 * Routine: $909D45 (heat_shimmer)
 * Bank: $90 (ROM Offset: $109D45)
 * Source: docs/disassembly/maps/heat-shimmer.md
 */

/**
 * @file heat-shimmer.c
 * @brief Secret of Evermore Environmental Heat Shimmer & Mirage HDMA Wave Engine
 * 
 * Reconstructed from 65816 assembly ($90:9D45 – $90:9DE7 and $80:AD28).
 */

#include <stdint.h>
#include <stdbool.h>

#define MAX_SCANLINE_BANDS 4
#define HDMA_TERMINATOR    0xFFFF
#define VISIBLE_SCREEN_LINES 224

/* ROM Coefficient Tables */
static const uint16_t tbl_heat_shimmer_scanline_bands[MAX_SCANLINE_BANDS + 1] = {
    0x0002, 0x0050, 0x00A0, HDMA_TERMINATOR
};

static const uint16_t tbl_heat_shimmer_wave_amplitudes_layer1[MAX_SCANLINE_BANDS + 1] = {
    0x0000, 0x0000, 0x0100, HDMA_TERMINATOR
};

static const uint16_t tbl_heat_shimmer_wave_amplitudes_layer2[MAX_SCANLINE_BANDS + 1] = {
    0x0020, 0x0000, 0x0000, HDMA_TERMINATOR
};

/* WRAM State Mirrors */
typedef struct {
    uint16_t bg1_scroll_x;        /* $7E:010E */
    uint16_t bg1_scroll_y;        /* $7E:0110 */
    uint16_t bg2_scroll_x;        /* $7E:0112 */
    uint16_t bg2_scroll_y;        /* $7E:0114 */
    uint16_t wave_timer;          /* $7E:0B19 */
    uint16_t hdma_active_buf_ptr; /* $7E:1518 */
    uint16_t hdma_buffer_a[18];   /* $7E:151A */
    uint16_t hdma_buffer_b[18];   /* $7E:153E */
    uint16_t camera_x;            /* DP $59   */
    uint16_t camera_y;            /* DP $5B   */
} HeatShimmerEngineState;

/* External sine generator helper ($80:ACF5) */
extern void snes_trig_lookup_sine_8bit(uint8_t multiplier_byte, uint16_t angle, uint16_t *out_lo, uint16_t *out_hi);

/**
 * @brief Fixed-point trigonometric sine scaling multiplier ($80:AD28).
 * 
 * Computes: (multiplier * sin(angle)) >> 8
 * 
 * @param multiplier 16-bit scaling amplitude
 * @param angle      10-bit angular phase (0..1023)
 * @return int16_t   Signed integer displacement (DP $03)
 */
int16_t trig_sine_fixed_point_scale(uint16_t multiplier, uint16_t angle) {
    uint16_t prod_lo1, prod_hi1;
    uint16_t prod_lo2, prod_hi2;

    /* Low-byte component */
    uint8_t mult_lo = (uint8_t)(multiplier & 0x00FF);
    snes_trig_lookup_sine_8bit(mult_lo, angle, &prod_lo1, &prod_hi1);

    /* High-byte component */
    uint8_t mult_hi = (uint8_t)((multiplier >> 8) & 0x00FF);
    snes_trig_lookup_sine_8bit(mult_hi, angle, &prod_lo2, &prod_hi2);

    /* Combine 32-bit partial sums */
    uint32_t full_acc = prod_lo1 | ((uint32_t)prod_hi1 << 16);
    full_acc += (uint32_t)(prod_lo2 & 0xFF00) << 8;
    full_acc += (uint32_t)prod_hi2 << 16;

    /* DP $03 represents bits 16..31 shifted down by 8, yielding the 16-bit integer component */
    return (int16_t)(full_acc >> 16);
}

/**
 * @brief Generates heat-shimmer HDMA line-displacement scroll table ($90:9D45).
 * 
 * @param state Pointer to engine WRAM state
 */
void room_effect_heat_shimmer_hdma_wave_generator(HeatShimmerEngineState *state) {
    /* 1. Synchronize PPU background scroll shadows */
    state->bg1_scroll_y = state->camera_y - 1;
    state->bg2_scroll_y = state->camera_y - 1;
    state->bg1_scroll_x = state->camera_x;
    state->bg2_scroll_x = state->camera_x;

    /* 2. Select ping-pong double buffer */
    uint16_t *target_table;
    if (state->hdma_active_buf_ptr == 0x151A) {
        target_table = state->hdma_buffer_b;
    } else {
        target_table = state->hdma_buffer_a;
    }

    /* 3. Compute 1024-step angular phase */
    uint16_t phase_angle = (state->wave_timer + state->camera_x) & 0x03FF;

    /* 4. First Loop: Generate wave displacement offsets */
    uint16_t *table_cursor = target_table + 1; /* Skip first word reserved for scanline height */
    for (int x = 0; x < MAX_SCANLINE_BANDS; x++) {
        uint16_t amp_layer1 = tbl_heat_shimmer_wave_amplitudes_layer1[x];
        if (amp_layer1 == HDMA_TERMINATOR) {
            break;
        }

        /* Compute Layer 1 horizontal displacement */
        int16_t disp_layer1 = trig_sine_fixed_point_scale(amp_layer1, phase_angle);
        table_cursor[6] = (uint16_t)disp_layer1; /* Stored at +0x0C bytes */

        /* Compute Layer 2 horizontal displacement */
        uint16_t amp_layer2 = tbl_heat_shimmer_wave_amplitudes_layer2[x];
        int16_t disp_layer2 = trig_sine_fixed_point_scale(amp_layer2, phase_angle);
        table_cursor[12] = (uint16_t)disp_layer2; /* Stored at +0x18 bytes */

        table_cursor++;
    }

    /* 5. Second Loop: Set scanline band heights clamped to screen bounds */
    table_cursor = target_table + 1;
    for (int x = 0; x < MAX_SCANLINE_BANDS; x++) {
        uint16_t band_threshold = tbl_heat_shimmer_scanline_bands[x];
        if (band_threshold == HDMA_TERMINATOR) {
            break;
        }

        int32_t relative_scanline = (int32_t)band_threshold - (int32_t)state->camera_y;

        /* If band is above the viewport, stop */
        if (relative_scanline < 0) {
            break;
        }

        /* If band is beyond visible 224 scanlines, stop */
        if (relative_scanline >= (VISIBLE_SCREEN_LINES - 1)) {
            break;
        }

        /* Valid visible scanline count */
        *table_cursor = (uint16_t)relative_scanline;
        table_cursor++;
    }

    /* 6. Write end-of-table terminator */
    *table_cursor = HDMA_TERMINATOR;
}
