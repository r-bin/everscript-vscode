/*
 * Routine: $919C90 (damage_mitigation)
 * Bank: $91 (ROM Offset: $119C90)
 * Source: docs/disassembly/combat/damage-mitigation.md
 */

#include <stdint.h>
#include <stdbool.h>

#define BOY_ACTOR_THRESHOLD 0x4E89
#define MIN_DAMAGE          1
#define MAX_DAMAGE_CAP      999

typedef struct {
    uint16_t spell_power; // +0x2A: Base spell power
    uint16_t targets[8];  // +0x2E: Null-terminated list of target entity addresses
} SpellEffectSlot;

typedef struct {
    uint16_t current_hp;  // Actor HP
    uint16_t max_hp;
} ActorStats;

extern const uint8_t g_stat_tables[0x20000]; // Bank $8E stat data
extern void inflict_actor_damage(uint16_t target_entity, uint16_t damage);

/**
 * Calculates defense reduction, clamps damage 1..999, and applies damage to targets.
 * Corresponds to $91:9C90.
 */
void apply_spell_damage_to_targets(SpellEffectSlot *slot) {
    uint16_t power = slot->spell_power;
    uint32_t total_damage = 0;

    for (int i = 0; i < 8; i++) {
        uint16_t target_ptr = slot->targets[i];
        if (target_ptr == 0) {
            break; // End of target list
        }

        int32_t net_damage;

        if (target_ptr >= BOY_ACTOR_THRESHOLD) {
            // Player Character (Boy or Dog): Direct linear subtraction
            uint16_t stat_offset = *(const uint16_t *)(g_stat_tables + target_ptr + 0x60);
            uint8_t mdef = g_stat_tables[0x1D + stat_offset];
            net_damage = (int32_t)power - mdef;
        } else {
            // Enemy Hurtbox: Fractional defense reduction (Power * (64 - MDef) / 64)
            uint16_t stat_offset = *(const uint16_t *)(g_stat_tables + target_ptr + 0x60);
            uint8_t mdef = g_stat_tables[0x1D + stat_offset];
            if (mdef > 64) mdef = 64;

            net_damage = ((int32_t)power * (64 - mdef)) / 64;
        }

        // Clamp Damage between 1 and 999
        if (net_damage < MIN_DAMAGE) {
            net_damage = MIN_DAMAGE;
        } else if (net_damage > MAX_DAMAGE_CAP) {
            net_damage = MAX_DAMAGE_CAP;
        }

        // Inflict damage, spawn floating combat text, trigger hurt state ($8F:C0D3)
        inflict_actor_damage(target_ptr, (uint16_t)net_damage);
        total_damage += (uint32_t)net_damage;
    }

    slot->spell_power = (uint16_t)total_damage;
}
