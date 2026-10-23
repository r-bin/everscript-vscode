/*
 * Routine: $919D16 (healing_spells)
 * Bank: $91 (ROM Offset: $119D16)
 * Source: docs/disassembly/combat/healing-spells.md
 */

#include <stdint.h>
#include <stdbool.h>

#define HEALING_CAP_HP      999
#define BOY_ENTITY_BASE     0x4E89
#define STATUS_UNCONSCIOUS  0x0400
#define STATUS_HURT_MASK    0x0478

typedef struct {
    uint8_t  pad0[0x12];
    uint16_t state_flags;    // +0x12: Entity state bits
    uint8_t  pad1[0x16];
    uint16_t current_hp;     // +0x2A: Entity current health
    uint8_t  pad2[0x34];
    uint16_t stat_index;     // +0x60: Master stat table index
    uint8_t  pad3[0x14];
    uint16_t hurt_timer;     // +0x76: Affliction ticker countdown
} EntityRecord;

typedef struct {
    uint8_t  pad0[0x2A];
    uint16_t spell_power;    // +0x2A: Computed formula power
} SpellSlotRecord;

extern const uint16_t g_master_max_hp[]; // ROM table $8E:000F

extern void trigger_palette_flash(uint16_t effect_id);
extern void update_player_hud_meters(EntityRecord *player);

/**
 * Commits HP healing to an entity: triggers green flash, caps at max HP,
 * synchronizes player HUD, and clears unconsciousness / hurt flags.
 * Corresponds to $8F:C09A.
 */
void entity_hp_heal_commit(EntityRecord *target, uint16_t heal_amount) {
    // 1. Trigger green healing visual palette flash
    trigger_palette_flash(0x7E80);

    // 2. Add healing to current HP, clamped to entity Max HP
    uint16_t max_hp = g_master_max_hp[target->stat_index];
    uint16_t new_hp = target->current_hp + heal_amount;
    if (new_hp > max_hp) {
        new_hp = max_hp;
    }
    target->current_hp = new_hp;

    // 3. If target is player character (Boy or Dog), synchronize HUD display
    if ((uintptr_t)target >= BOY_ENTITY_BASE) {
        update_player_hud_meters(target);
    }

    // 4. Reset poison/damage ticker and clear unconscious state
    target->hurt_timer = 0;
    target->state_flags &= ~STATUS_HURT_MASK;
}

/**
 * Top-level alchemy healing effect dispatcher.
 * Corresponds to $91:9D16.
 */
void alchemy_healing_effect_handler(SpellSlotRecord *slot, EntityRecord *target) {
    uint16_t power = slot->spell_power;
    if (power > HEALING_CAP_HP) {
        power = HEALING_CAP_HP;
    }

    entity_hp_heal_commit(target, power);
}
