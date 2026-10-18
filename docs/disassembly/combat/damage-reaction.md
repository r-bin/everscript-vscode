# Entity Damage Processing, HUD HP Sync & Recoil Reaction

## Overview
When an entity incurs physical, projectile, or alchemical damage, the engine converts `pending_damage` (`+$76`) into concrete health loss, records it into `last_damage_taken` (`+$AA`), updates the HUD display if the target possesses an active health bar (`+$8E`), and triggers a hit reaction animation.

If the entity takes fatal damage or a qualifying flinch hit, the recoil dispatcher inverts its facing direction, sets temporary invulnerability flags, and initiates the character-specific damage animation track via `$90:8124`.

---

## Memory Map & Data Structures

### Entity Structure Offsets (`$7E:XXXX`)
- `+0x10`: `status_flags` (Bit 6: in hit recoil / temporary invulnerability `0x0040`)
- `+0x12`: `anim_state` (Bits 8-9: movement transition mode)
- `+0x14`: `character_flags` (Bit 10: player flinch reaction asserted `0x0400`)
- `+0x16`: `combat_flags` (Bit 0: flinch eligibility)
- `+0x22`: `facing_direction` (Compass direction; XOR 8 inverts facing 180 degrees)
- `+0x2A`: `current_hp` (Remaining hit points)
- `+0x36`: `knockback_speed` (Step displacement during knockback)
- `+0x60`: `anim_table_ptr` (Pointer to character animation descriptor table in bank `$8E`)
- `+0x76`: `pending_damage` (Damage queued to be subtracted this tick)
- `+0x78`: `latch_timer` (Immobilization duration timer)
- `+0x8E`: `hud_bar_active` (Non-zero if entity is tracked on the active HP bar)
- `+0xAA`: `last_damage_taken` (Records recent hit damage)

### WRAM Globals
- `$7E:2261`: `barrier_buff_flags` (Bit 0: Companion Barrier, Bit 1: Boy Barrier)
- `$7E:0EB8`: `combat_flow_flags` (Bit 5: force stagger / boss recoil override)
- `$4E89`: Base address of Boy entity structure

---

## Decompiled C Code

```c
#include <stdint.h>
#include <stdbool.h>

typedef struct {
    uint8_t  padding0[0x10];
    uint16_t status_flags;        // +0x10: Entity status (Bit 6: 0x0040 = hit recoil)
    uint16_t anim_state;          // +0x12: Animation mode bits
    uint16_t character_flags;     // +0x14: Player flags (Bit 10: 0x0400 = flinch)
    uint16_t combat_flags;        // +0x16: Combat reaction flags
    uint8_t  padding1[0x0A];
    uint16_t facing_direction;    // +0x22: Direction (0..15)
    uint8_t  padding2[0x06];
    uint16_t current_hp;          // +0x2A: Remaining HP
    uint8_t  padding3[0x0A];
    uint16_t knockback_speed;     // +0x36: Recoil velocity
    uint8_t  padding4[0x28];
    uint16_t anim_table_ptr;      // +0x60: Pointer to animation definition in Bank $8E
    uint8_t  padding5[0x14];
    uint16_t pending_damage;      // +0x76: Incoming queued damage
    uint16_t latch_timer;         // +0x78: Immobilization timer
    uint8_t  padding6[0x14];
    uint16_t hud_bar_active;      // +0x8E: HUD tracking flag
    uint8_t  padding7[0x1A];
    uint16_t last_damage_taken;   // +0xAA: Most recent hit value
} Entity;

#define WRAM_BARRIER_BUFF_FLAGS (*(volatile uint16_t*)0x7E2261)
#define WRAM_COMBAT_FLOW_FLAGS  (*(volatile uint16_t*)0x7E0EB8)
#define ENTITY_BOY_BASE         ((Entity*)0x4E89)

// External Subroutines
extern void anim_engine_launch_track(uint16_t track_id);     // $90:8124
extern void format_digits_to_tiles(uint16_t value, uint16_t *buf); // $80:870C

/**
 * $8F:9144 - Formats entity HP digits and writes "current / max" tiles into the HUD.
 */
void hud_render_entity_hp_string(Entity *entity) {
    if (!entity) return;

    // Check if Magic Barrier is active; if active, barrier absorbs the damage display
    if (entity == ENTITY_BOY_BASE) {
        if (WRAM_BARRIER_BUFF_FLAGS & 0x0002) return;
    } else {
        if (WRAM_BARRIER_BUFF_FLAGS & 0x0001) return;
    }

    // Resolve HUD tile buffer destination
    uint16_t current_hp = entity->current_hp;
    uint16_t digits[8];
    format_digits_to_tiles(current_hp, digits);

    // Read maximum HP from character descriptor +0x0F
    const uint8_t *desc = (const uint8_t*)(*(const uint16_t*)(0x8E0000 + entity->anim_table_ptr));
    uint16_t max_hp = *(const uint16_t*)(desc + 0x0F);
    
    // Renders "current_hp / max_hp" with base tile 0x2BEC and separator 0x2BF8 ('/')
    // Tile emission omitted for brevity
}

/**
 * $8F:C290 - Triggers hit reaction, inverts facing direction, and starts recoil track.
 */
void entity_trigger_damage_animation(Entity *entity) {
    if (!entity) return;

    // Invert facing direction 180 degrees (EOR 8) to face attacker
    if (entity->knockback_speed != 0) {
        entity->facing_direction ^= 0x0008;
    }

    // Set Bit 6: In Hit Recoil / Invulnerable (0x0040), clear Bit 0
    entity->status_flags = (entity->status_flags & (uint16_t)~0x2001) | 0x0040;

    // Clear animation transit bits
    entity->anim_state &= (uint16_t)~0x0300;

    // If player or companion, assert flinch flag (Bit 10: 0x0400)
    if (entity >= ENTITY_BOY_BASE) {
        entity->character_flags |= 0x0400;
    }

    // Read damage recoil animation track index from character descriptor +0x40
    const uint8_t *desc = (const uint8_t*)(*(const uint16_t*)(0x8E0000 + entity->anim_table_ptr));
    uint16_t damage_track_id = *(const uint16_t*)(desc + 0x40);

    // Reset latch timer
    entity->latch_timer = 0;

    // Launch damage animation track in the animation VM
    anim_engine_launch_track(damage_track_id);
}

/**
 * $8F:C25D - Processes pending damage and determines if flinch / recoil occurs.
 */
void entity_process_damage_recoil(Entity *entity) {
    if (!entity) return;

    // Transfer queued damage to last damage taken field
    entity->last_damage_taken = entity->pending_damage;

    // If entity has an active HUD health bar, update display text
    if (entity->hud_bar_active != 0) {
        hud_render_entity_hp_string(entity);
    }

    // Clear pending damage
    entity->pending_damage = 0;

    // If entity was killed (HP == 0), immediately dispatch death recoil animation
    if (entity->current_hp == 0) {
        entity_trigger_damage_animation(entity);
        return;
    }

    // Check combat flinch eligibility conditions
    if (entity->combat_flags & 0x0001) {
        if (entity->status_flags & 0x0040) {
            return; // Already in recoil invulnerability
        }
    }

    // Check boss / combat flow override flag
    if (WRAM_COMBAT_FLOW_FLAGS & 0x0020) {
        entity_trigger_damage_animation(entity);
        return;
    }
}
```
