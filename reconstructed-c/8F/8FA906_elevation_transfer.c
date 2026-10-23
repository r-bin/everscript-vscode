/*
 * Routine: $8FA906 (elevation_transfer)
 * Bank: $8F (ROM Offset: $0FA906)
 * Source: docs/disassembly/maps/elevation-transfer.md
 */

/**
 * @file elevation-transfer.c
 * @brief Secret of Evermore Elevation Plane Transition, Collision Probe & Gravity Engine
 * 
 * Reconstructed from 65816 assembly ($8F:A906 – $8F:A962 and $8F:AF48 – $8F:B020).
 */

#include <stdint.h>
#include <stdbool.h>

#define COLLISION_WALL_SOLID     0x8000
#define COLLISION_ALWAYS_WALK    0x2000
#define COLLISION_BRIDGE_RAMP    0x0040
#define COLLISION_PLANE_MASK     0x0030

#define ENTITY_FLAG_FLYING       0x0800
#define ENTITY_FLAG_GROUND       0x0480

typedef struct EntityNode {
    struct EntityNode *next;     /* +$00 */
    uint16_t status_flags;       /* +$10 */
    uint16_t elevation_plane;    /* +$18 */
    int16_t  velocity_z;         /* +$1E */
    int16_t  gravity_timer;      /* +$20 */
    uint16_t metatile_grid_idx;  /* +$3A */
    uint16_t cached_collision;   /* +$3C */
    uint16_t world_x;            /* +$46 */
    uint16_t world_y;            /* +$48 */
} EntityNode;

typedef struct {
    uint16_t active_elevation_plane; /* DP $44 */
    uint16_t step_dither_phase;      /* $7E:0F36 */
    EntityNode *entity_list_head;    /* $7E:3DDF */
} ElevationEngineState;

/* 4-step dither phase table ($8F:B090) */
static const uint8_t tbl_step_dither_3_2_0_1[4] = { 3, 2, 0, 1 };

/* External hardware / map collision helpers */
extern uint16_t map_get_collision_word(uint16_t world_x, uint16_t world_y);
extern bool     viewport_screen_bounds_test(uint16_t world_x, uint16_t world_y);
extern bool     body_collision_actor_test(EntityNode *entity, uint16_t target_x, uint16_t target_y);

/**
 * @brief Updates entity elevation plane and bridge transparency ($8F:A906).
 * 
 * @param collision_word 16-bit metatile collision word
 * @param state          Pointer to engine state
 */
void elevation_plane_update_bits_5_4_kept_on(uint16_t collision_word, ElevationEngineState *state) {
    if ((collision_word & (COLLISION_ALWAYS_WALK | COLLISION_BRIDGE_RAMP)) != 0) {
        if ((collision_word & COLLISION_BRIDGE_RAMP) == 0) {
            /* Step onto bridge ramp: retain plane bits and set bridge transparency flag */
            state->active_elevation_plane = (collision_word & COLLISION_PLANE_MASK) | COLLISION_BRIDGE_RAMP;
        } else {
            /* Step off bridge ramp: clear bridge transparency flag */
            state->active_elevation_plane &= ~COLLISION_BRIDGE_RAMP;
        }
    } else {
        /* Standard plane latch */
        state->active_elevation_plane = collision_word & COLLISION_PLANE_MASK;
    }
}

/**
 * @brief Validates elevation plane transition eligibility ($8F:A946).
 * 
 * @param candidate_collision 16-bit collision word of candidate cell
 * @param state               Pointer to engine state
 * @return bool True if step permitted, False if blocked by elevation barrier
 */
bool elevation_plane_transition_gate(uint16_t candidate_collision, ElevationEngineState *state) {
    if ((candidate_collision & (COLLISION_ALWAYS_WALK | COLLISION_BRIDGE_RAMP)) != 0) {
        elevation_plane_update_bits_5_4_kept_on(candidate_collision, state);
        return true;
    }

    uint16_t plane_diff = candidate_collision ^ state->active_elevation_plane;

    /* Check if bridge transparency is currently active */
    if ((state->active_elevation_plane & COLLISION_BRIDGE_RAMP) != 0) {
        /* Latch into the destination elevation plane */
        state->active_elevation_plane = candidate_collision & COLLISION_PLANE_MASK;
        return true;
    }

    /* Strict plane match required */
    if ((plane_diff & COLLISION_PLANE_MASK) != 0) {
        return false; /* Elevation barrier mismatch -> Blocked! */
    }

    return true; /* Planes match -> Allowed */
}

/**
 * @brief Composite 3-tier entity movement probe ($8F:AF48).
 * 
 * @param entity   Pointer to moving entity
 * @param target_x Proposed target coordinate X
 * @param target_y Proposed target coordinate Y
 * @param state    Pointer to engine state
 * @return bool True if step approved, False if blocked
 */
bool probe_metatile_collision(EntityNode *entity, uint16_t target_x, uint16_t target_y, ElevationEngineState *state) {
    state->active_elevation_plane = entity->elevation_plane;

    /* 1. Flying / Ethereal bypass */
    if ((entity->status_flags & ENTITY_FLAG_FLYING) != 0) {
        uint16_t cell_word = map_get_collision_word(target_x, target_y);
        elevation_plane_update_bits_5_4_kept_on(cell_word, state);
        entity->elevation_plane = state->active_elevation_plane;
        return true; /* Flying entities ignore ground obstacles */
    }

    /* 2. Elevation plane transition test */
    uint16_t candidate_collision = map_get_collision_word(target_x, target_y);
    if (!elevation_plane_transition_gate(candidate_collision, state)) {
        return false; /* Blocked by elevation ramp / ledge */
    }
    entity->elevation_plane = state->active_elevation_plane;

    /* 3. Viewport & room boundary limit test */
    if (!viewport_screen_bounds_test(target_x, target_y)) {
        return false; /* Blocked by room boundary */
    }

    /* 4. Solid actor hitbox collision test */
    if (!body_collision_actor_test(entity, target_x, target_y)) {
        return false; /* Blocked by another solid actor */
    }

    return true; /* All checks passed! */
}

/**
 * @brief Master per-frame entity physics and vertical gravity stepper ($8F:AFAE / $8F:AFF5).
 * 
 * @param state Pointer to engine state
 */
void entity_physics_and_gravity_tick(ElevationEngineState *state) {
    /* 1. Advance step dither phase */
    state->step_dither_phase = tbl_step_dither_3_2_0_1[state->step_dither_phase & 0x03];

    /* 2. Iterate across active entity linked list */
    EntityNode *curr = state->entity_list_head;
    while (curr != NULL) {
        /* Cache underlying metatile collision word */
        curr->cached_collision = map_get_collision_word(curr->world_x, curr->world_y);

        /* 3. Integrate vertical gravity ($8F:AFF5) */
        curr->gravity_timer--;
        int16_t new_velocity = curr->velocity_z + curr->gravity_timer;

        if (new_velocity <= 0) {
            /* Landed on ground plane: arrest momentum */
            curr->gravity_timer = 0;
            curr->velocity_z = 0;
        } else {
            /* Still airborne */
            curr->velocity_z = new_velocity;
        }

        curr = curr->next;
    }
}
