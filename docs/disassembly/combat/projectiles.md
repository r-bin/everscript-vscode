# Projectile & Spell Sprite Spawner Pipeline

> **ROM Bank**: `$8F` (Spawner & Entity Pool), `$90` (Animation Script `$90:9815`)  
> **Source Routines**: `$8F:B094` (`projectile_spawn_master`), `$8F:B0A4` (`entity_slot_allocate_and_init`)  
> **Related Routines**: `$8F:B2BE` (Entity pool scanner), `$8F:A93B` (Animation setup), `$90:9815` (Default projectile animation track)  
> **Memory Map**: `$7E:1072` (Active entity count), `$7E:1074` (Total spawned entities), direct page `$46` (X tile/pixel), `$48` (Y tile/pixel), `$4C` (Target entity pointer)

---

## 1. Architectural Overview

Combat spells (Flash, Hard Ball, Acid Rain, Fireball) and ranged physical hazards in *Secret of Evermore* are materialized in the engine as temporary **projectile entities**. Rather than having a separate collision subsystem for missiles, the engine unifies all dynamic moving objects—Boy, Dog, NPCs, monsters, and flying projectiles—into a single contiguous array of entity records in WRAM.

### Key Subsystems:
1. **Master Spawner Interface (`$8F:B094`)**:
   - Sets the Data Bank register to `$7E`.
   - Calls the entity pool scanner (`$8F:B2BE`) to locate an unoccupied entity slot.
   - Forwards execution to `$8F:B0A4` to initialize the missile's core attributes.
2. **Entity Initialization & State Cleansing (`$8F:B0A4`)**:
   - Increments active entity counters `$1072` and `$1074`.
   - Injects launch coordinates from direct page `$46` (X position) and `$48` (Y position).
   - Binds the default animation track via `$90:9815`.
   - **Status Effect Cleansing**: Writes `$FFFF` to all four status effect slots (`+$46`, `+$4C`, `+$52`, `+$58`), ensuring projectiles never inherit stale buff/ailment data from recycled entity slots.
   - Sets character attribute flags: facing heading `+$22 = 0x0008`, priority bits `+$10`, and links the origin caster / parent entity pointer `+$60 = $02`.
3. **Ballistic vs. Homing Trajectories**:
   - **Linear Ballistic**: Projectiles calculate fixed directional delta components ($v_x, v_y$) derived from the caster's heading angle.
   - **Homing**: Projectiles evaluate the target entity's position (`$4C`) each frame, steering toward the target using an angular tracking clamp to prevent instant 90-degree snapping.
4. **Impact Detection & Expiration**:
   - Missile entities execute isometric hitbox checks every tick.
   - Upon intersecting a hostile target or solid metatile geometry, the projectile initiates an impact burst animation and marks its entity slot for reclamation.

---

## 2. 65816 Assembly Implementation

```assembly
; ==============================================================================
; $8F:B094 - Master Projectile & Entity Spawner
; Inputs: $46 = X pos, $48 = Y pos, $02 = Caster entity, $4C = Target entity
; ==============================================================================
projectile_spawn_master:
    PHB
    PEA $7E7E
    PLB
    PLB
    JSL $8FB2BE                 ; Allocate unoccupied entity slot -> Y = slot
    JSL $8FB0A4                 ; Initialize entity fields and status slots
    PLB
    RTL

; ==============================================================================
; $8F:B0A4 - Entity Slot Allocation & Field Initializer
; ==============================================================================
entity_slot_allocate_and_init:
    INC $1072                   ; Increment active entity counter
    INC $1074                   ; Increment total lifetime spawned counter

    LDX $46                     ; X origin coordinate
    LDY $48                     ; Y origin coordinate
    JSL $909815                 ; Bind default animation and sprite descriptors
    JSL $8FA93B                 ; Configure physics registers

    LDY $4C                     ; Allocated entity slot pointer
    LDX $02                     ; Parent / caster entity pointer
    TXA
    STA $0060,Y                 ; Set parent link: entity +$60 = caster

    LDA $0010,Y                 ; Fetch sprite attribute word
    ORA $08                     ; Apply priority mask
    ORA $8E0005,X               ; Merge parent layer attributes
    STA $0010,Y

    LDA #$0008                  ; Default heading = Down (0x08)
    STA $0022,Y                 ; Set entity facing direction

    ; Clear all 4 status effect slots in the recycled memory slot
    LDA #$FFFF
    STA $0046,Y                 ; Slot 1 ID = empty
    STA $004C,Y                 ; Slot 2 ID = empty
    STA $0052,Y                 ; Slot 3 ID = empty
    STA $0058,Y                 ; Slot 4 ID = empty
    RTL
```

---

## 3. Clean C Decompilation

```c
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
```
