/*
 * Routine: $8FADAA (conveyor_physics)
 * Bank: $8F (ROM Offset: $0FADAA)
 * Source: docs/disassembly/maps/conveyor-physics.md
 */

#include <stdint.h>
#include <stdbool.h>

#define ENTITY_FLAG_STEP_SUCCESS     0x0001  /* +$12 bit 0 */
#define ENTITY_FLAG_WALL_BLOCKED     0x0002  /* +$12 bit 1 */

#define TILE_ATTR_CONVEYOR_STAIRS    0x2000  /* +$3C bit 13 */
#define MOVEMENT_MODE_FLYING         0x0800  /* +$10 bit 11 */
#define MOVEMENT_MODE_GHOST          0x0480  /* +$10 bits 10/7 */

typedef struct {
    uint16_t movement_mode_10;      /* +$10: movement flags */
    uint16_t reaction_flags_12;     /* +$12: step status / collisions */
    uint16_t state_flags_16;        /* +$16 */
    uint16_t elevation_plane;       /* +$18: 0..3 layer plane */
    int16_t  x;                     /* +$1A: subpixel/pixel X */
    int16_t  y;                     /* +$1C: subpixel/pixel Y */
    uint16_t collision_tile_3C;     /* +$3C: metatile collision word */
} PhysicsEntity;

/* Jump Table for 16 Conveyor / Ramp Impulse Presets ($8F:AF30) */
typedef void (*ConveyorImpulseFunc)(PhysicsEntity *entity, int16_t *dx, int16_t *dy);
extern const ConveyorImpulseFunc g_conveyor_impulse_table[16];

/* External Collision Routines */
extern bool probe_elevation_plane_ramp(int16_t x, int16_t y, uint16_t plane); /* $8F:A946 */
extern bool probe_viewport_boundary(int16_t x, int16_t y);                    /* $90:9561 */
extern bool probe_actor_hitbox_collision(PhysicsEntity *entity, int16_t x, int16_t y); /* $8F:B4AB */
extern void handle_collision_recoil(PhysicsEntity *entity);                    /* $8F:C2E4 */
extern void update_elevation_plane_flying(int16_t x, int16_t y, uint16_t *plane); /* $8F:A906 */

/**
 * Composite collision probe testing elevation plane, viewport limits, and solid actors.
 * Corresponds to native routine $8F:AF48.
 *
 * @param entity Entity attempting movement.
 * @param target_x Proposed X coordinate.
 * @param target_y Proposed Y coordinate.
 * @return True if target location is unblocked, false if obstructed.
 */
bool collision_probe_and_plane_update(PhysicsEntity *entity, int16_t target_x, int16_t target_y) {
    // Flying / ethereal bypass
    if (entity->movement_mode_10 & MOVEMENT_MODE_FLYING) {
        update_elevation_plane_flying(target_x, target_y, &entity->elevation_plane);
        return true;
    }

    if (entity->movement_mode_10 & MOVEMENT_MODE_GHOST) {
        return true;
    }

    // Ground tier checks
    if (!probe_elevation_plane_ramp(target_x, target_y, entity->elevation_plane)) {
        return false;
    }

    if (!probe_viewport_boundary(target_x, target_y)) {
        return false;
    }

    if (!probe_actor_hitbox_collision(entity, target_x, target_y)) {
        return false;
    }

    return true; // Path is completely clear
}

/**
 * Resolves proposed displacement vector (dx, dy), handling conveyor impulses,
 * diagonal stair elevation shear, and orthogonal wall sliding.
 * Corresponds to native routines $8F:ADAA - $8F:AF0E.
 *
 * @param entity Entity attempting movement step.
 * @param dx Proposed horizontal delta.
 * @param dy Proposed vertical delta.
 */
void entity_mover_step_and_shear_resolution(PhysicsEntity *entity, int16_t dx, int16_t dy) {
    // Check conveyor / stair ramp tile attribute bit 13
    if (entity->collision_tile_3C & TILE_ATTR_CONVEYOR_STAIRS) {
        uint8_t preset = entity->collision_tile_3C & 0x000F;
        if (g_conveyor_impulse_table[preset] != NULL) {
            g_conveyor_impulse_table[preset](entity, &dx, &dy);
        }
    }

    // Stationary test
    if (dx == 0 && dy == 0) {
        entity->reaction_flags_12 |= ENTITY_FLAG_STEP_SUCCESS;
        return;
    }

    int16_t target_x = entity->x + dx;
    int16_t target_y = entity->y + dy;

    // 1. Probe direct trajectory
    if (collision_probe_and_plane_update(entity, target_x, target_y)) {
        // Direct move succeeded
        entity->x = target_x;
        entity->y = target_y;
        entity->reaction_flags_12 |= ENTITY_FLAG_STEP_SUCCESS;
        return;
    }

    // Direct move blocked: attempt orthogonal shear / wall slide
    bool shear_succeeded = false;

    if (dx == 0) {
        // Pure vertical blocked: test horizontal drift (+dy or -dy)
        if (collision_probe_and_plane_update(entity, entity->x + dy, target_y)) {
            target_x = entity->x + dy;
            shear_succeeded = true;
        } else if (collision_probe_and_plane_update(entity, entity->x - dy, target_y)) {
            target_x = entity->x - dy;
            shear_succeeded = true;
        }
    } else if (dy == 0) {
        // Pure horizontal blocked: test vertical drift (-dx or +dx)
        if (collision_probe_and_plane_update(entity, target_x, entity->y - dx)) {
            target_y = entity->y - dx;
            shear_succeeded = true;
        } else if (collision_probe_and_plane_update(entity, target_x, entity->y + dx)) {
            target_y = entity->y + dx;
            shear_succeeded = true;
        }
    } else {
        // Diagonal move blocked: test single-axis wall slide
        if (collision_probe_and_plane_update(entity, target_x, entity->y)) {
            // Horizontal sliding unblocked
            target_y = entity->y;
            shear_succeeded = true;
        } else if (collision_probe_and_plane_update(entity, entity->x, target_y)) {
            // Vertical sliding unblocked
            target_x = entity->x;
            shear_succeeded = true;
        }
    }

    if (shear_succeeded) {
        entity->x = target_x;
        entity->y = target_y;
        entity->reaction_flags_12 |= ENTITY_FLAG_STEP_SUCCESS;
    } else {
        // Fully obstructed: trigger obstacle collision reaction
        entity->reaction_flags_12 |= ENTITY_FLAG_WALL_BLOCKED;
        handle_collision_recoil(entity);
    }
}
