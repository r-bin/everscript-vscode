/*
 * Routine: $8FB6AE (attack_procs)
 * Bank: $8F (ROM Offset: $0FB6AE)
 * Source: docs/disassembly/combat/attack-procs.md
 */

#include <stdint.h>
#include <stdbool.h>

typedef struct EntityRecord {
    uint8_t  _pad0[16];
    uint16_t status_flags_10; // +0x10: 0 = inactive/deleted
    uint16_t hurt_state_12;   // +0x12: Hurt animation/reaction bits
    uint8_t  _pad1[22];
    uint16_t hp;              // +0x2A: Hit points
    uint8_t  _pad2[10];
    uint16_t last_attacker;   // +0x36: Attacker pointer
    uint16_t hit_cooldown;    // +0x38: Immunity countdown timer
} EntityRecord;

// Global engine state
extern EntityRecord *g_boy_entity;          // $7E:4E89
extern EntityRecord *g_dog_entity;          // $7E:4F37
extern EntityRecord *g_attacker_entity;     // DP $4C
extern uint16_t      g_attack_power_param;  // $7E:0E9C
extern EntityRecord *g_projectile_entity;   // $7E:0E9E
extern uint16_t      g_damage_dealt;        // $7E:0EA0

// Subsystem routines
extern bool to_hit_check_melee(EntityRecord *target);       // $8F:BA06
extern bool to_hit_check_projectile(EntityRecord *target);  // $8F:B9F8
extern void calc_damage_melee(EntityRecord *target);        // $8F:C067
extern void calc_damage_scaled(uint16_t power, EntityRecord *target); // $8F:C06D
extern void calc_damage_spell(uint16_t power, EntityRecord *target);  // $8F:C07E
extern void apply_damage_and_reaction(EntityRecord *target); // $8F:C0D3
extern void apply_knockback_physics(EntityRecord *target);  // $8F:C17F
extern void award_boy_weapon_xp(EntityRecord *target);      // $8F:973E
extern void award_dog_combat_xp(EntityRecord *target);      // $8F:97C0

/**
 * Checks if the damage dealt resulted in a lethal blow, and awards experience
 * to either the Boy or Dog character.
 */
static void check_fatal_blow_and_award_xp(EntityRecord *target) {
    if (g_damage_dealt == 0) {
        return;
    }

    // Check if target HP was reduced to or below 0
    if (g_damage_dealt >= target->hp) {
        if (g_attacker_entity == g_boy_entity) {
            award_boy_weapon_xp(target);
        } else if (g_attacker_entity == g_dog_entity) {
            award_dog_combat_xp(target);
        }
    }
}

/**
 * attack_proc_melee_arc ($8F:B6CC) - Proc 0
 * Standard melee weapon strike. Evaluates to-hit, computes damage, and triggers
 * recoil. Returns true to allow the sweep to continue through all valid enemies.
 */
bool attack_proc_melee_arc(EntityRecord *target) {
    if (!to_hit_check_melee(target)) {
        return true; // Miss: continue sweep
    }

    calc_damage_melee(target);
    apply_damage_and_reaction(target);
    apply_knockback_physics(target);

    return true; // Carry Set: sweep entire weapon arc
}

/**
 * attack_proc_projectile_consumable ($8F:B6E0) - Proc 2
 * Standard projectile strike (arrow, thrown spear, mud ball). On connect,
 * applies damage, deletes the projectile entity, and stops the hit scan.
 */
bool attack_proc_projectile_consumable(EntityRecord *target) {
    if (!to_hit_check_projectile(target)) {
        return true; // Miss: continue projectile trajectory
    }

    // 1. Calculate scaled damage from weapon power parameter
    calc_damage_scaled(g_attack_power_param, target);
    apply_damage_and_reaction(target);
    apply_knockback_physics(target);

    // 2. Consume projectile: delete entity record
    if (g_projectile_entity != NULL) {
        g_projectile_entity->status_flags_10 = 0;
    }

    // 3. Award XP if fatal blow
    check_fatal_blow_and_award_xp(target);

    // 4. Return Carry Clear: terminate hit test (projectile is consumed)
    return false;
}

/**
 * attack_proc_projectile_piercing ($8F:B724) - Proc 4
 * Piercing projectile strike (level 3 spear wave, charged energy beam).
 * Deals damage without deleting the projectile, allowing multi-hit penetration.
 */
bool attack_proc_projectile_piercing(EntityRecord *target) {
    if (!to_hit_check_projectile(target)) {
        return true;
    }

    calc_damage_scaled(g_attack_power_param, target);
    apply_damage_and_reaction(target);
    apply_knockback_physics(target);

    // Award XP if fatal blow
    check_fatal_blow_and_award_xp(target);

    // Return Carry Set: continue penetration through subsequent entities
    return true;
}

/**
 * attack_proc_spell_burst ($8F:B73C) - Proc 6
 * Spell burst projectile strike. Applies alchemy/spell damage formula and
 * consumes the projectile.
 */
bool attack_proc_spell_burst(EntityRecord *target) {
    if (!to_hit_check_projectile(target)) {
        return true;
    }

    calc_damage_spell(g_attack_power_param, target);
    apply_damage_and_reaction(target);
    apply_knockback_physics(target);

    // Consume projectile
    if (g_projectile_entity != NULL) {
        g_projectile_entity->status_flags_10 = 0;
    }

    check_fatal_blow_and_award_xp(target);

    return false;
}
