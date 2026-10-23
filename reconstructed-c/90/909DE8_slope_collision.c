/*
 * Routine: $909DE8 (slope_collision)
 * Bank: $90 (ROM Offset: $109DE8)
 * Source: docs/disassembly/maps/slope-collision.md
 */

#include <stdint.h>
#include <stdbool.h>

#define COLLISION_GEOMETRY_MASK  0x000F
#define COLLISION_PLANE_MASK     0x0030
#define COLLISION_FLAG_PT        0x0040 /* Bit 6: Plane-Transparent */
#define COLLISION_ENTITY_GATE    0x0F00 /* Bits 11..8: Entity Gate Nibble */
#define COLLISION_GATE_ACTIVE    0x0100 /* Bit 8: Gate Active Flag */
#define COLLISION_FLAG_AW        0x2000 /* Bit 13: Always-Walkable / Conveyor */

#define GEOMETRY_OPEN            0x00
#define GEOMETRY_SOLID           0x0F

typedef struct {
    int16_t dx;
    int16_t dy;
} Vector2D;

/**
 * Tests whether a point within a metatile falls within the solid half-plane
 * of a given sub-tile slope or barrier geometry code.
 *
 * @param geom_code Sub-tile geometry nibble (0x0..0xF).
 * @param px        Fine X pixel offset within cell (0..15).
 * @param py        Fine Y pixel offset within cell (0..15).
 * @return True if the point is solid (impassable), false if walkable.
 */
bool is_subtile_slope_solid(uint8_t geom_code, uint8_t px, uint8_t py) {
    switch (geom_code & 0x0F) {
        case 0x00:
            return false; /* Fully open */
        case 0x01:
        case 0x05:
            return (px + py) >= 15; /* South-East 45° slope */
        case 0x02:
        case 0x06:
            return py >= px; /* South-West 45° slope */
        case 0x03:
        case 0x04:
            return py >= 8; /* Top barrier (North half open, South solid) */
        case 0x07:
            return px < 8; /* East barrier (West open, East solid) */
        case 0x08:
            return px >= 8; /* West barrier (East open, West solid) */
        case 0x09:
        case 0x0D:
            return py <= px; /* North-East 45° slope */
        case 0x0A:
        case 0x0E:
            return (px + py) <= 15; /* North-West 45° slope */
        case 0x0B:
        case 0x0C:
            return py < 8; /* Bottom barrier (North solid, South open) */
        case 0x0F:
        default:
            return true; /* Fully solid */
    }
}

/**
 * Evaluates the conveyor impulse or diagonal stairway shear vector from
 * an always-walkable metatile (collision word bit 13 = 1).
 *
 * Implements the exact behavioral dispatch of $8F:AD9F through $8F:AF28.
 *
 * @param collision_word 16-bit metatile collision word.
 * @param world_x        Current entity world X coordinate.
 * @param world_y        Current entity world Y coordinate.
 * @param current_dx     Entity current horizontal velocity dx.
 * @return Directional velocity delta to apply to the entity.
 */
Vector2D eval_tile_drift_vector(uint16_t collision_word, uint16_t world_x, uint16_t world_y, int16_t current_dx) {
    Vector2D drift = { 0, 0 };

    /* Only tiles with bit 13 set generate drift impulses */
    if ((collision_word & COLLISION_FLAG_AW) == 0) {
        return drift;
    }

    uint8_t dir = collision_word & COLLISION_GEOMETRY_MASK;

    switch (dir) {
        case 0x01:
            /* Diagonal Stairs Shear Push (Positive 45° Ramp) */
            if (((world_x ^ world_y) & 0x0004) != 0) {
                if (current_dx > 0) {
                    drift.dy = -2; /* Moving East pushes North */
                } else if (current_dx < 0) {
                    drift.dy = +2; /* Moving West pushes South */
                }
            }
            break;

        case 0x02:
            /* Reverse Diagonal Stairs Shear Push (Negative 45° Ramp) */
            if (((world_x ^ world_y) & 0x0004) != 0) {
                if (current_dx > 0) {
                    drift.dy = +2; /* Moving East pushes South */
                } else if (current_dx < 0) {
                    drift.dy = -2; /* Moving West pushes North */
                }
            }
            break;

        case 0x08: drift.dx =  0; drift.dy = -2; break; /* North */
        case 0x09: drift.dx = +1; drift.dy = -1; break; /* North-East */
        case 0x0A: drift.dx = +2; drift.dy =  0; break; /* East */
        case 0x0B: drift.dx = +1; drift.dy = +1; break; /* South-East */
        case 0x0C: drift.dx = -1; drift.dy = -1; break; /* North-West */
        case 0x0D: drift.dx = -2; drift.dy =  0; break; /* West */
        case 0x0E: drift.dx = -1; drift.dy = +1; break; /* South-West */
        case 0x0F: drift.dx =  0; drift.dy = +2; break; /* South */

        case 0x00:
        case 0x03:
        case 0x04:
        case 0x05:
        case 0x06:
        case 0x07:
        default:
            /* Neutral walkable: no drift */
            break;
    }

    return drift;
}
