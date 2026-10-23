/*
 * Routine: $8FB75A (special_attack_procs)
 * Bank: $8F (ROM Offset: $0FB75A)
 * Source: docs/disassembly/combat/special-attack-procs.md
 */

#include <stdint.h>
#include <stdbool.h>

typedef struct EntityRecord {
    uint8_t  _pad0[22];
    uint16_t collision_mode;   // +0x16: Bit 0x0001 = latch-immune
    uint8_t  _pad1[18];
    uint16_t hp;               // +0x2A: Current HP
    uint8_t  _pad2[76];
    uint16_t latch_timer;      // +0x78: Latch duration countdown timer
} EntityRecord;

// Global engine state
extern EntityRecord *g_attacker_entity;     // DP $4C
extern uint16_t      g_damage_dealt;        // $7E:0EA0
extern uint16_t      g_global_buff_flags;   // $7E:2261
extern uint16_t      g_latch_anchor_x;      // DP $5D
extern uint16_t      g_latch_anchor_y;      // DP $5E

// Downstream engine subroutines
extern bool to_hit_check_melee(EntityRecord *target);                       // $8F:BA06
extern void calc_damage_melee(EntityRecord *target);                        // $8F:C067
extern void apply_damage_and_reaction(EntityRecord *target);                 // $8F:C0D3
extern void apply_damage_custom_reaction(EntityRecord *target);              // $8F:C143
extern void apply_knockback_physics(EntityRecord *target);                  // $8F:C17F
extern void award_boy_weapon_xp(EntityRecord *target);                      // $8F:973E
extern void award_dog_combat_xp(EntityRecord *target);                      // $8F:97C0
extern void entity_set_animation(EntityRecord *entity, uint16_t anim_id);   // $90:8124
extern uint16_t rng_next_word(void);                                        // $80:859B
extern void status_effect_apply(EntityRecord *target, uint16_t effect_id);  // $91:B632
extern void launch_script_thread(uint32_t far_script_addr);                 // $8C:C521

/**
 * attack_proc_melee_boy_kill_xp ($8F:B75A) - Proc 8
 * Melee attack that directly awards Boy weapon skill XP if fatal.
 */
bool attack_proc_melee_boy_kill_xp(EntityRecord *target) {
    if (!to_hit_check_melee(target)) {
        return true;
    }

    calc_damage_melee(target);
    apply_damage_and_reaction(target);
    apply_knockback_physics(target);

    if (g_damage_dealt != 0 && g_damage_dealt >= target->hp) {
        award_boy_weapon_xp(target);
    }

    return true; // Carry Set: sweep arc
}

/**
 * attack_proc_melee_dog_kill_xp ($8F:B77D) - Proc 10
 * Melee attack that directly awards Dog combat XP if fatal.
 */
bool attack_proc_melee_dog_kill_xp(EntityRecord *target) {
    if (!to_hit_check_melee(target)) {
        return true;
    }

    calc_damage_melee(target);
    apply_damage_and_reaction(target);
    apply_knockback_physics(target);

    if (g_damage_dealt != 0 && g_damage_dealt >= target->hp) {
        award_dog_combat_xp(target);
    }

    return true; // Carry Set: sweep arc
}

/**
 * attack_proc_dog_latch_bite ($8F:B7A0) - Proc 12
 * Companion Dog latch-and-bite attack. Deals damage and latches Dog onto the victim
 * for 18 frames unless target is latch-immune.
 */
bool attack_proc_dog_latch_bite(EntityRecord *target) {
    if (!to_hit_check_melee(target)) {
        return true;
    }

    calc_damage_melee(target);
    apply_damage_and_reaction(target);
    apply_knockback_physics(target);

    // If target has latch immunity (bit 0x0001), do not cling
    if (target->collision_mode & 0x0001) {
        return true;
    }

    // Attach Dog to target
    EntityRecord *dog = g_attacker_entity;
    if (dog != NULL) {
        dog->latch_timer = 18; // 18 frames latch duration
        entity_set_animation(dog, 0x4982); // Clinging / biting animation

        g_latch_anchor_x = (uint16_t)(uintptr_t)target;
        g_latch_anchor_y = (uint16_t)((uintptr_t)target >> 8);
    }

    // Terminate hit scan (Dog is now latched onto this single entity)
    return false;
}

/**
 * attack_proc_status_strike ($8F:B7D7) - Proc 14
 * Specialized strike that plays custom status hit reaction ($8F:C143).
 */
bool attack_proc_status_strike(EntityRecord *target) {
    if (g_global_buff_flags & 0x0080) {
        return true;
    }

    if (!to_hit_check_melee(target)) {
        return true;
    }

    calc_damage_melee(target);
    apply_damage_custom_reaction(target);
    apply_knockback_physics(target);

    return true;
}

/**
 * attack_proc_poison_strike ($8F:B7F3) - Proc 16
 * Weapon strike that inflicts status effect 0x0090 with a 25% RNG probability.
 */
bool attack_proc_poison_strike(EntityRecord *target) {
    if (g_global_buff_flags & 0x0080) {
        return true;
    }

    if (!to_hit_check_melee(target)) {
        return true;
    }

    calc_damage_melee(target);
    apply_damage_and_reaction(target);
    apply_knockback_physics(target);

    // 25% chance (lower 2 bits of RNG roll == 0)
    if ((rng_next_word() & 0x0003) == 0) {
        status_effect_apply(target, 0x0090);
        launch_script_thread(0x8FB856);
    }

    return true;
}
