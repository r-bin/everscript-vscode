/*
 * Routine: $91D800 (alchemy_ingredients)
 * Bank: $91 (ROM Offset: $11D800)
 * Source: docs/disassembly/combat/alchemy-ingredients.md
 */

#include <stdint.h>
#include <stdbool.h>

#define NUM_ALCHEMY_FORMULAS        35
#define NUM_INGREDIENTS             22

#define INVENTORY_INGREDIENT_BASE   0x22FF
#define FORMULA_XP_BASE             0x2F52
#define FORMULA_LEVEL_BASE          0x2ED6
#define FORMULA_USAGE_BASE          0x2FDE

#define TABLE_ALCHEMY_COST          0xC4601F
#define TABLE_XP_PER_CAST           0xC45B9C
#define TABLE_LEVEL_MULTIPLIERS     0xC45BA5

/* 10 XP per cast at Lv0 tapering to 1 XP at Lv6..Lv9 */
static const uint8_t s_xp_per_cast[10] = { 10, 5, 4, 3, 2, 2, 1, 1, 1, 1 };

/* Damage/Effect level scaling multipliers */
static const uint8_t s_level_multipliers[10] = { 2, 4, 7, 11, 15, 20, 26, 32, 39, 46 };

typedef struct {
    uint8_t ing1_id;
    uint8_t ing2_id;
    uint8_t qty1;
    uint8_t qty2;
} AlchemyFormulaCost;

/**
 * Validates inventory and deducts alchemical ingredients for spell cast ($91:D800).
 *
 * @param formula_index Index of the formula (0..34).
 * @return True if cost requirements were met and ingredients were deducted.
 */
bool alchemy_validate_and_deduct_cost(uint8_t formula_index) {
    if (formula_index >= NUM_ALCHEMY_FORMULAS) {
        return false;
    }

    uint32_t cost_addr = TABLE_ALCHEMY_COST + (formula_index * 4);
    AlchemyFormulaCost cost = {
        .ing1_id = read_rom8(cost_addr + 0),
        .ing2_id = read_rom8(cost_addr + 1),
        .qty1    = read_rom8(cost_addr + 2),
        .qty2    = read_rom8(cost_addr + 3),
    };

    /* 1. Check Ingredient 1 */
    uint16_t ing1_addr = INVENTORY_INGREDIENT_BASE + cost.ing1_id;
    uint8_t owned1 = read_wram8(ing1_addr);
    if (owned1 < cost.qty1) {
        return false; // Insufficient Ingredient 1
    }

    /* 2. Check Ingredient 2 (if required) */
    uint16_t ing2_addr = 0;
    uint8_t owned2 = 0;
    if (cost.qty2 > 0) {
        ing2_addr = INVENTORY_INGREDIENT_BASE + cost.ing2_id;
        owned2 = read_wram8(ing2_addr);
        if (owned2 < cost.qty2) {
            return false; // Insufficient Ingredient 2
        }
    }

    /* 3. Deduct ingredients from WRAM */
    write_wram8(ing1_addr, owned1 - cost.qty1);
    if (cost.qty2 > 0) {
        write_wram8(ing2_addr, owned2 - cost.qty2);
    }

    /* 4. Increment usage counter ($7E:2FDE + X) */
    uint16_t usage = read_wram16(FORMULA_USAGE_BASE + (formula_index * 2));
    write_wram16(FORMULA_USAGE_BASE + (formula_index * 2), usage + 1);

    return true;
}

/**
 * Awards formula experience and manages level progression ($91:D850).
 *
 * @param formula_index Index of the formula (0..34).
 */
void alchemy_award_cast_experience(uint8_t formula_index) {
    if (formula_index >= NUM_ALCHEMY_FORMULAS) {
        return;
    }

    uint16_t lvl_addr = FORMULA_LEVEL_BASE + (formula_index * 2);
    uint16_t xp_addr  = FORMULA_XP_BASE + (formula_index * 2);

    uint16_t current_level = read_wram16(lvl_addr);
    uint16_t current_xp    = read_wram16(xp_addr);

    if (current_level >= 9 && current_xp >= 99) {
        return; // Max Level 9:99 capped
    }

    // Determine XP gain based on current level (0..9)
    uint8_t lvl_clamped = (current_level > 9) ? 9 : (uint8_t)current_level;
    uint8_t xp_gain = s_xp_per_cast[lvl_clamped];

    current_xp += xp_gain;

    // Check level-up threshold at 100 XP
    if (current_xp >= 100) {
        current_xp -= 100;
        if (current_level < 9) {
            current_level++;
        } else {
            current_xp = 99; // Cap at 9:99
        }
    }

    write_wram16(lvl_addr, current_level);
    write_wram16(xp_addr, current_xp);
}
