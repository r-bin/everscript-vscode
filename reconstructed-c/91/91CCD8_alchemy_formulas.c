/*
 * Routine: $91CCD8 (alchemy_formulas)
 * Bank: $91 (ROM Offset: $11CCD8)
 * Source: docs/disassembly/combat/alchemy-formulas.md
 */

#include <stdint.h>
#include <stdbool.h>

#define MAX_FORMULA_LEVEL   9
#define XP_PER_LEVEL        100

// ROM Master Tables (Bank $C4)
extern const uint8_t  g_level_multipliers[10]; // $C4:5BA5: [2, 4, 7, 11, 15, 20, 26, 32, 39, 46]
extern const uint8_t  g_xp_gains[10];          // $C4:5B9C: [10, 5, 4, 3, 2, 2, 1, 1, 1, 1]
extern const uint16_t g_base_powers[35];        // $C4:5E6B: Base spell powers

typedef struct {
    uint16_t formula_xp[35];     // $7E:2F52: 0..99 XP
    uint16_t formula_level[35];  // $7E:2F98: 0..9 Level
    uint16_t formula_usage[35];  // $7E:2FDE: Lifetime cast counter
} AlchemyPlayerStats;

typedef struct {
    uint16_t caster_ptr;         // +0x28: Pointer to casting entity
    uint16_t final_power;        // +0x2A: Computed spell power
    uint16_t targets[8];         // +0x2E: Null-terminated list of target entity pointers
} ActiveSpellSlot;

extern AlchemyPlayerStats g_alchemy_stats;
extern uint16_t rng_bounded(uint16_t max);
extern void play_level_up_sfx(uint8_t formula_idx);

/**
 * Executes formula cast math: computes power, multi-target split, RNG, and XP gain.
 * Corresponds to $91:CCD8.
 */
void calc_spell_power_and_cast(uint8_t formula_idx, ActiveSpellSlot *slot, uint16_t caster_ptr) {
    slot->caster_ptr = caster_ptr;

    // 1. Count Active Targets
    uint16_t target_count = 0;
    while (target_count < 8 && slot->targets[target_count] != 0) {
        target_count++;
    }

    // 2. Gross Power (Base Power * Level Multiplier)
    uint16_t level = g_alchemy_stats.formula_level[formula_idx];
    if (level > MAX_FORMULA_LEVEL) level = MAX_FORMULA_LEVEL;

    uint16_t base_power = g_base_powers[formula_idx];
    uint16_t level_mult = g_level_multipliers[level];
    uint32_t gross_power = (uint32_t)base_power * level_mult;

    // 3. Multi-Target Split: Gross Power / (Target Count + 1)
    uint16_t divided_power = (uint16_t)(gross_power / (target_count + 1));

    // 4. Random Variance: 50% min + RNG(0 .. 50%)
    uint16_t base_min_power = divided_power / 2;
    uint16_t variance_range = divided_power - base_min_power;
    uint16_t random_bonus   = rng_bounded(variance_range);

    slot->final_power = base_min_power + random_bonus;

    // 5. Formula Experience (XP) Progression
    uint16_t xp_gain = g_xp_gains[level];
    uint16_t total_xp = g_alchemy_stats.formula_xp[formula_idx] + xp_gain;

    if (total_xp >= XP_PER_LEVEL) {
        if (g_alchemy_stats.formula_level[formula_idx] < MAX_FORMULA_LEVEL) {
            g_alchemy_stats.formula_level[formula_idx]++;
            g_alchemy_stats.formula_xp[formula_idx] = total_xp - XP_PER_LEVEL;
            play_level_up_sfx(formula_idx);
        } else {
            g_alchemy_stats.formula_xp[formula_idx] = 99; // Cap at 9:99
        }
    } else {
        g_alchemy_stats.formula_xp[formula_idx] = total_xp;
    }

    // Increment lifetime cast statistics
    g_alchemy_stats.formula_usage[formula_idx]++;
}

/**
 * Applies spell damage to target hurtbox with magic defense mitigation.
 * Corresponds to $91:9C90.
 */
int16_t apply_spell_damage(uint16_t power, uint8_t target_mdef) {
    if (target_mdef > 64) target_mdef = 64;
    // Net Damage = Power * (64 - Magic_Defense) / 64
    uint32_t net = ((uint32_t)power * (64 - target_mdef)) >> 6;
    return (int16_t)net;
}
