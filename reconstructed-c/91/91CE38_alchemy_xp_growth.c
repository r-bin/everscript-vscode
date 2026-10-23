/*
 * Routine: $91CE38 (alchemy_xp_growth)
 * Bank: $91 (ROM Offset: $11CE38)
 * Source: docs/disassembly/combat/alchemy-xp-growth.md
 */

#include <stdint.h>
#include <stdbool.h>

#define MAX_FORMULAS        35
#define MAX_FORMULA_LEVEL   9
#define XP_PER_LEVEL        100
#define DISABLED_PALETTE    0xA8EB  /* Bank $D0:A8EB greyscale palette */

/* ROM Tables (Bank $C4) */
typedef struct {
    uint8_t ing1_id;
    uint8_t ing2_id;
    uint8_t ing1_qty;
    uint8_t ing2_qty;
} AlchemyIngredientCost;

extern const AlchemyIngredientCost g_alchemy_costs[MAX_FORMULAS]; /* $C4:601F */
extern const uint8_t g_alchemy_xp_gain[10];                      /* $C4:5B9C: [10, 5, 4, 3, 2, 2, 1, 1, 1, 1] */
extern const uint16_t g_alchemy_name_ptrs[MAX_FORMULAS];         /* $C4:5D09 */

/* WRAM State */
typedef struct {
    uint8_t  inventory_ingredients[256]; /* $7E:22FF + ID */
    uint16_t formula_xp[MAX_FORMULAS];    /* $7E:2F52 + (ID * 2) */
    uint16_t formula_level[MAX_FORMULAS]; /* $7E:2F98 + (ID * 2) */
} AlchemyGameState;

extern AlchemyGameState g_alchemy_state;

/* Sound & Notification Engine */
extern void sound_play_chime(uint16_t sfx_id); /* $80:B37A */

/**
 * Calculates the maximum number of times a formula can be cast given current ingredient stock.
 * Corresponds to native routine $91:CE38.
 *
 * @param formula_index Step-2 formula identifier (0, 2, 4, ..., 68).
 * @return Available casts (0 if out of ingredients, or min ratio of ingredients).
 */
uint16_t alchemy_formula_calc_available_casts(uint16_t formula_index) {
    uint16_t table_index = formula_index >> 1; // Convert step-2 to step-1
    if (table_index >= MAX_FORMULAS) {
        return 0;
    }

    const AlchemyIngredientCost *cost = &g_alchemy_costs[table_index];

    // Evaluate Ingredient 1
    uint8_t inv1 = g_alchemy_state.inventory_ingredients[cost->ing1_id];
    uint16_t casts1 = (cost->ing1_qty > 0) ? (inv1 / cost->ing1_qty) : 999;

    // Evaluate Ingredient 2
    uint8_t inv2 = g_alchemy_state.inventory_ingredients[cost->ing2_id];
    uint16_t casts2 = (cost->ing2_qty > 0) ? (inv2 / cost->ing2_qty) : 999;

    // Usable casts is the limiting ingredient
    uint16_t available_casts = (casts1 < casts2) ? casts1 : casts2;
    return available_casts;
}

/**
 * Ring menu icon animation opcode 0x56 handler ($90:878C).
 * Updates icon palette based on cast availability.
 *
 * @param icon_entity Pointer to ring menu icon entity record.
 * @param formula_index Formula identifier.
 */
void alchemy_icon_palette_greyout_check(void *icon_entity, uint16_t formula_index) {
    typedef struct {
        uint8_t pad[12];
        uint16_t palette_override; /* +$0C */
    } RingIconEntity;

    RingIconEntity *icon = (RingIconEntity *)icon_entity;
    uint16_t available = alchemy_formula_calc_available_casts(formula_index);

    if (available == 0) {
        // Disabled: grey out icon with monochrome palette
        icon->palette_override = DISABLED_PALETTE;
    }
}

/**
 * Awards formula experience on cast and handles mastery level ups ($91:CD44).
 *
 * @param formula_index Step-2 formula identifier.
 * @return True if formula leveled up, false otherwise.
 */
bool alchemy_formula_award_cast_xp(uint16_t formula_index) {
    uint16_t slot = formula_index >> 1;
    if (slot >= MAX_FORMULAS) {
        return false;
    }

    uint16_t current_level = g_alchemy_state.formula_level[slot];
    if (current_level > MAX_FORMULA_LEVEL) {
        current_level = MAX_FORMULA_LEVEL;
    }

    uint8_t xp_gain = g_alchemy_xp_gain[current_level];
    uint16_t new_xp = g_alchemy_state.formula_xp[slot] + xp_gain;

    if (new_xp >= XP_PER_LEVEL) {
        // Level up occurred!
        new_xp -= XP_PER_LEVEL;
        g_alchemy_state.formula_xp[slot] = new_xp;

        if (current_level < MAX_FORMULA_LEVEL) {
            g_alchemy_state.formula_level[slot] = current_level + 1;
        }

        // Play level up chime
        sound_play_chime(0x0012);
        return true;
    } else {
        g_alchemy_state.formula_xp[slot] = new_xp;
        return false;
    }
}
