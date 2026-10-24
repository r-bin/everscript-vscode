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

/* elevation_vector_shear_step ($8F:A963), elevation_manhattan_distance_eval ($8F:A97D) and
 * elevation_compass_direction_resolve ($8F:A999) are in their own files, exact to the ROM (gate G1). */
