/*
 * Routine: $8FC237 (defense_barrier)
 * Bank: $8F (ROM Offset: $0FC237)
 * Source: docs/disassembly/combat/defense-barrier.md
 */

#include <stdint.h>
#include <stdbool.h>

// Status Effect Slot Layout (6 bytes per slot)
typedef struct {
    uint16_t status_id;         // +0x00: Status ID ($FFFF = empty, Bit 15 = recency flag)
    uint16_t timer;             // +0x02: Duration countdown in frames
    uint16_t boost_param;       // +0x04: Attribute boost or shield strength
} StatusSlot;

typedef struct Entity {
    uint8_t    padding0[0x10];
    uint16_t   status_flags;        // +0x10: Entity status (Bit 6: 0x0040 = hit recoil)
    uint16_t   anim_state;          // +0x12: Animation mode bits
    uint16_t   character_flags;     // +0x14: Player flags (Bit 10: 0x0400 = flinch)
    uint16_t   combat_flags;        // +0x16: Combat reaction flags
    uint16_t   world_z;             // +0x18: 3D Elevation
    uint16_t   world_x;             // +0x1A: 2D X Coordinate
    uint16_t   world_y;             // +0x1C: 2D Y Coordinate
    uint8_t    padding1[0x06];
    uint16_t   facing_direction;    // +0x22: Direction (0..15)
    uint8_t    padding2[0x06];
    uint16_t   current_hp;          // +0x2A: Current Hit Points
    uint8_t    padding3[0x0A];
    uint16_t   knockback_speed;     // +0x36: Recoil velocity
    uint8_t    padding4[0x0E];
    StatusSlot status_slots[4];     // +0x46..+0x5C: 4 Status Effect Slots
    uint8_t    padding5[0x02];
    uint16_t   anim_table_ptr;      // +0x60: Pointer to animation definition in Bank $8E
    uint8_t    padding6[0x08];
    int16_t    shadow_entity_id;    // +0x6A: Ground shadow child attachment
    int16_t    held_entity_id;      // +0x6C: Weapon child attachment
    uint8_t    padding7[0x08];
    uint16_t   pending_damage;      // +0x76: Incoming queued strike damage
    uint16_t   latch_timer;         // +0x78: Immobilization timer
    uint8_t    padding8[0x14];
    uint16_t   hud_bar_active;      // +0x8E: HUD tracking flag
    uint8_t    padding9[0x08];
    int16_t    aux_entity_id;       // +0x98: Barrier / Force Field child attachment
    uint16_t   outline_glow_bits;   // +0x9A: Active shader color cycling bits
    uint8_t    padding10[0x0E];
    uint16_t   last_damage_taken;   // +0xAA: Most recent hit value
} Entity;

// WRAM Globals
#define WRAM_BARRIER_BUFF_FLAGS  (*(volatile uint16_t*)0x7E2261)
#define WRAM_BUFF_FLAGS_2        (*(volatile uint16_t*)0x7E2262)
#define WRAM_SILENT_CLEANUP_FLAG (*(volatile uint16_t*)0x7E15D2)
#define ENTITY_BOY_BASE          ((Entity*)0x4E89)
#define ENTITY_DOG_BASE          ((Entity*)0x4F37)

// Status IDs
#define STATUS_ID_ATLAS          0x0000
#define STATUS_ID_BARRIER        0x0008
#define STATUS_ID_DEFEND         0x0010
#define STATUS_ID_REFLECT        0x0018
#define STATUS_ID_SPEED          0x0020
#define STATUS_ID_EMPTY          0xFFFF

// External Subroutines
extern void     spawn_floating_damage_number(uint16_t damage);           // $8F:C09A
extern void     entity_process_damage_recoil(Entity *entity);            // $8F:C25D
extern void     entity_set_position_with_z(Entity *entity, uint16_t x,   // $8F:C2E4
                                           uint16_t y, uint16_t z);
extern void     character_defense_and_buff_rebuild(void);                // $8F:8398
extern void     status_purge_slot(uint16_t status_id);                   // $91:B9A7
extern void     cutscene_script_enqueue(uint16_t string_key);            // $8C:C521
extern Entity*  get_active_entity_by_slot(int16_t slot_id);              // $7E:50A7 lookup

/**
 * $8F:C237 - Applies pending damage to entity HP with barrier damage nullification.
 */
void pending_damage_applied_to_hp(Entity *entity) {
    if (!entity || entity->pending_damage == 0) {
        return;
    }

    bool is_absorbed = false;

    // Check Party Magic Barrier status condition
    if (entity == ENTITY_BOY_BASE) {
        if (WRAM_BARRIER_BUFF_FLAGS & 0x0002) {
            is_absorbed = true;
        }
    } else if (entity == ENTITY_DOG_BASE) {
        if (WRAM_BARRIER_BUFF_FLAGS & 0x0001) {
            is_absorbed = true;
        }
    } else {
        // Enemies and generic entities: check temporary invulnerability
        if (entity->status_flags & 0x0040) {
            is_absorbed = true;
        }
    }

    if (is_absorbed) {
        // Barrier absorbs 100% of damage: nullify damage and display "0" pop-up
        entity->pending_damage = 0;
        spawn_floating_damage_number(0);
    } else {
        // Subtract pending damage, clamped at 0 HP
        if (entity->current_hp <= entity->pending_damage) {
            entity->current_hp = 0;
        } else {
            entity->current_hp -= entity->pending_damage;
        }
    }

    // Advance to recoil and flinch evaluation
    entity_process_damage_recoil(entity);
}

/**
 * $8F:A7D3 - Synchronizes attached child entity (barrier bubble / aura) to host.
 */
void entity_child_reposition(int16_t child_id, Entity *parent) {
    if (child_id < 0 || !parent) {
        return;
    }

    Entity *child = get_active_entity_by_slot(child_id);
    if (!child) {
        return;
    }

    // Lock child coordinates directly to parent world position
    child->world_x = parent->world_x;
    child->world_y = parent->world_y;
    child->world_z = parent->world_z;

    // Re-evaluate tile elevation and layer plane
    entity_set_position_with_z(child, child->world_x, child->world_y, child->world_z);
}

/**
 * $91:B830 - Per-frame countdown timer tick for Barrier status.
 */
void status_barrier_tick(Entity *entity, StatusSlot *slot) {
    if (!slot || slot->timer == 0) {
        return;
    }

    slot->timer--;
    if (slot->timer == 0) {
        status_barrier_cleanup(entity, slot);
    }
}

/**
 * $91:B856 - Removes Barrier status buff and cleans up child barrier aura.
 */
void status_barrier_cleanup(Entity *entity, StatusSlot *slot) {
    if (!entity) {
        return;
    }

    // Display "Barrier has worn off" if not in silent mode
    if (WRAM_SILENT_CLEANUP_FLAG == 0) {
        cutscene_script_enqueue(0x0048); // "Barrier has worn off"
    }

    // Clear Barrier condition bits from WRAM globals
    if (entity == ENTITY_BOY_BASE) {
        WRAM_BUFF_FLAGS_2 &= (uint16_t)~0x0080;       // Clear MDef shield bit
        WRAM_BARRIER_BUFF_FLAGS &= (uint16_t)~0x0002; // Clear Boy active barrier
    } else if (entity == ENTITY_DOG_BASE) {
        WRAM_BARRIER_BUFF_FLAGS &= (uint16_t)~0x0001; // Clear Dog active barrier
    }

    // Re-calculate party defensive attributes
    character_defense_and_buff_rebuild();

    // Clear slot in entity struct and deactivate shader glow
    status_purge_slot(STATUS_ID_BARRIER);

    // Detach child barrier bubble entity
    entity->aux_entity_id = -1;
}

/**
 * $91:B137 - Applies Defend / stat buff boosts to character record.
 */
void defend_status_buff_boost_stats(Entity *entity, StatusSlot *slot, uint16_t final_power) {
    if (!entity || !slot) {
        return;
    }

    // Store boost parameter and standard 3600-frame (60s) duration
    slot->boost_param = final_power;
    slot->timer = 3600;

    // Trigger outline shader cycling in entity record
    entity->outline_glow_bits |= 0x0002;

    // Rebuild character defense attributes with new modifier
    character_defense_and_buff_rebuild();
}
