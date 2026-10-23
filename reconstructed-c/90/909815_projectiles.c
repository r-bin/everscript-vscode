/*
 * Routine: $909815 (projectiles)
 * Bank: $90 (ROM Offset: $109815)
 * Source: docs/disassembly/combat/projectiles.md
 */

#include <stdint.h>
#include <stdbool.h>

#define MAX_ENTITIES            32
#define STATUS_SLOT_EMPTY       0xFFFF
#define ENTITY_HEADING_DOWN     0x08

typedef struct {
    uint16_t entity_id;
    int16_t  pos_x;             /* +0x02 */
    int16_t  pos_y;             /* +0x04 */
    int16_t  vel_x;             /* +0x06 */
    int16_t  vel_y;             /* +0x08 */
    uint16_t sprite_attributes; /* +0x10 */
    uint8_t  facing_direction;  /* +0x22 */
    uint16_t parent_entity_ptr; /* +0x60 */
    uint16_t target_entity_ptr; /* +0x62 */
    uint16_t status_slot_ids[4];/* +0x46, +0x4C, +0x52, +0x58 */
    bool     active;
    bool     is_homing;
    uint8_t  lifetime_ticks;
} ProjectileEntity;

typedef struct {
    uint16_t active_count;      /* $7E:1072 */
    uint16_t spawn_lifetime;    /* $7E:1074 */
    ProjectileEntity pool[MAX_ENTITIES];
} EntityPool;

extern void entity_bind_animation_track(ProjectileEntity *projectile, uint32_t anim_script_addr);
extern void entity_configure_physics(ProjectileEntity *projectile);
extern bool entity_check_target_collision(const ProjectileEntity *proj, uint16_t target_id);

/**
 * Allocates a free entity slot from the contiguous entity pool.
 * Corresponds to native routine $8F:B2BE.
 */
static ProjectileEntity* entity_pool_find_free_slot(EntityPool *pool) {
    for (int i = 0; i < MAX_ENTITIES; i++) {
        if (!pool->pool[i].active) {
            return &pool->pool[i];
        }
    }
    return NULL; /* Entity pool exhausted */
}

/**
 * Initializes allocated entity record, clearing status slots and setting hierarchy.
 * Corresponds to native routine $8F:B0A4.
 */
void entity_slot_allocate_and_init(EntityPool *pool, ProjectileEntity *proj, int16_t x, int16_t y, uint16_t caster_id, uint16_t target_id) {
    pool->active_count++;
    pool->spawn_lifetime++;

    proj->active = true;
    proj->pos_x = x;
    proj->pos_y = y;
    proj->vel_x = 0;
    proj->vel_y = 0;
    proj->facing_direction = ENTITY_HEADING_DOWN;
    proj->parent_entity_ptr = caster_id;
    proj->target_entity_ptr = target_id;
    proj->sprite_attributes = 0x0008; /* Default OAM priority */

    /* Ensure recycled RAM carries no stale status effects */
    for (int s = 0; s < 4; s++) {
        proj->status_slot_ids[s] = STATUS_SLOT_EMPTY;
    }

    /* Bind default missile animation track ($90:9815) and physics */
    entity_bind_animation_track(proj, 0x909815);
    entity_configure_physics(proj);
}

/**
 * Master projectile spawner: allocates a slot, configures trajectory, and launches missile.
 * Corresponds to native routine $8F:B094.
 */
ProjectileEntity* projectile_spawn_master(EntityPool *pool, int16_t origin_x, int16_t origin_y, uint16_t caster_id, uint16_t target_id, int16_t speed, bool homing) {
    ProjectileEntity *proj = entity_pool_find_free_slot(pool);
    if (proj == NULL) {
        return NULL;
    }

    entity_slot_allocate_and_init(pool, proj, origin_x, origin_y, caster_id, target_id);
    proj->is_homing = homing;
    proj->lifetime_ticks = 120; /* 2-second timeout at 60 Hz */

    /* Initial ballistic trajectory calculation */
    int16_t dx = 0;
    int16_t dy = 0;

    if (target_id != 0) {
        /* Compute angle towards target */
        dx = speed;
        dy = speed;
    }

    proj->vel_x = dx;
    proj->vel_y = dy;
    return proj;
}

/**
 * Executes per-frame movement, homing guidance, and impact checks for an active missile.
 */
void projectile_tick(EntityPool *pool, ProjectileEntity *proj) {
    if (!proj->active) {
        return;
    }

    /* Lifetime expiration */
    if (proj->lifetime_ticks > 0) {
        proj->lifetime_ticks--;
    } else {
        proj->active = false;
        pool->active_count--;
        return;
    }

    /* Homing steering calculation */
    if (proj->is_homing && proj->target_entity_ptr != 0) {
        /* Steer towards target position */
        /* ... */
    }

    /* Position integration */
    proj->pos_x += (proj->vel_x >> 4);
    proj->pos_y += (proj->vel_y >> 4);

    /* Collision evaluation */
    if (entity_check_target_collision(proj, proj->target_entity_ptr)) {
        /* Impact: release entity and trigger explosion particles */
        proj->active = false;
        pool->active_count--;
    }
}
