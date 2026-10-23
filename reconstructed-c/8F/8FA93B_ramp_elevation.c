/*
 * Routine: $8FA93B (ramp_elevation)
 * Bank: $8F (ROM Offset: $0FA93B)
 * Source: docs/disassembly/maps/ramp-elevation.md
 */

#include <stdint.h>
#include <stdbool.h>

/**
 * Projects the candidate metatile collision layer plane into active elevation context.
 *
 * @param collision_word 16-bit metatile attribute word
 * @param current_plane Current active layer in DP $44
 * @return Updated elevation layer plane
 */
uint8_t elevation_ramp_plane_project(uint16_t collision_word, uint8_t current_plane) {
    // Bit 13 indicates a ramp connecting planes: preserve bridge transition
    if (collision_word & 0x2000) {
        return current_plane;
    }

    // Extract elevation plane bits 5..4
    return (uint8_t)(collision_word & 0x0030);
}

/**
 * Calculates the Chebyshev minimum coordinate delta: min(|dx|, |dy|).
 */
uint8_t elevation_vector_shear_step(int8_t dx, int8_t dy) {
    uint8_t abs_dx = (dx < 0) ? (uint8_t)(-dx) : (uint8_t)dx;
    uint8_t abs_dy = (dy < 0) ? (uint8_t)(-dy) : (uint8_t)dy;

    return (abs_dy < abs_dx) ? abs_dy : abs_dx;
}

/**
 * Evaluates diagonal distance projection across quadrants: |dx ± dy|.
 */
uint8_t elevation_manhattan_distance_eval(int8_t dx, int8_t dy) {
    if ((dx ^ dy) < 0) {
        int16_t sum = dx + dy;
        return (sum < 0) ? (uint8_t)(-sum) : (uint8_t)sum;
    } else {
        int16_t diff = dx - dy;
        return (diff < 0) ? (uint8_t)(-diff) : (uint8_t)diff;
    }
}

/**
 * Resolves 4-way cardinal compass direction from signed coordinate deltas.
 */
uint8_t elevation_compass_direction_resolve(int8_t dx, int8_t dy) {
    if (dx < 0) {
        if (dy < 0) {
            return HEADING_WEST;
        } else {
            return HEADING_NORTH;
        }
    } else {
        if (dy < 0) {
            return HEADING_SOUTH;
        } else {
            return HEADING_EAST;
        }
    }
}
