/*
 * Routine: $8FB75A (to_hit_accuracy)
 * Bank: $8F (ROM Offset: $0FB75A)
 * Source: docs/disassembly/combat/to-hit-accuracy.md
 */

#include <stdint.h>
#include <stdbool.h>

#define HIT_COOLDOWN_TICKS 21 // 0x0015 ticks (~0.35s at 60fps)
#define MIN_HIT_CHANCE 5

typedef struct {
    uint16_t entity_id;         // +0x00
    uint8_t  padding_1[0x40];
    uint16_t hit_rate;          // +0x42: Accuracy
    uint16_t evade;             // +0x44: Evasion
    uint8_t  padding_2[0x2C];
    uint16_t last_attacker_id;  // +0x72: Attacker slot tracking
    uint16_t hit_cooldown;      // +0x74: Cooldown timer
    uint16_t pending_damage;    // +0x76: Damage accumulator
} CombatEntity;

extern uint16_t get_random_number(void); // $80:859B

/**
 * Checks if target entity is currently invulnerable to repeat attacks from this source.
 * Corresponds to $8F:BA1A.
 */
bool hit_cooldown_check_and_reset(CombatEntity *target, CombatEntity *attacker) {
    if (target->last_attacker_id == attacker->entity_id && target->hit_cooldown > 0) {
        return false; // Blocked: still in 21-frame cooldown
    }

    // Allow hit and reset invulnerability timer
    target->last_attacker_id = attacker->entity_id;
    target->hit_cooldown = HIT_COOLDOWN_TICKS;
    return true;
}

/**
 * Evaluates attack to-hit accuracy against target evade.
 * Corresponds to $8F:B75A.
 */
bool to_hit_evade_vs_hit_rate(const CombatEntity *attacker, const CombatEntity *target) {
    int32_t net_hit_rate = (int32_t)attacker->hit_rate - (int32_t)target->evade;

    if (net_hit_rate < MIN_HIT_CHANCE) {
        net_hit_rate = MIN_HIT_CHANCE;
    }

    uint16_t roll = get_random_number() % 100;
    return roll < (uint32_t)net_hit_rate;
}

/**
 * Adds damage amount into target entity's pending damage field (+0x76).
 * Corresponds to $8F:C067.
 */
void physical_damage_into_pending(CombatEntity *target, uint16_t damage) {
    target->pending_damage += damage;
}
