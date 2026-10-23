/*
 * Routine: $919BCC (spell_targeting)
 * Bank: $91 (ROM Offset: $119BCC)
 * Source: docs/disassembly/combat/spell-targeting.md
 */

#include <stdint.h>
#include <stdbool.h>

#define MAX_HP_CAP 999
#define EFFECT_DONE_BIT 0x0002

typedef struct {
    uint16_t x;
    uint16_t y;
    uint16_t flags_26;      // +0x26: VM synchronization flags
    uint16_t formula_id;    // +0x28
    uint16_t output_value;  // +0x2A
    uint16_t *target_list;  // +0x2E
} SpellEffectSlot;

extern uint16_t g_max_hp;       // $7E:0A35
extern uint16_t g_target_hp;    // $7E:4EB3

/**
 * Checks if the animation script has signaled phase completion (opcode 0x5D).
 * Corresponds to $91:9BCC and $91:9D2E.
 * Returns true if done, false if still animating.
 */
bool reads_an_effect_done_bit(SpellEffectSlot *slot) {
    if ((slot->flags_26 & EFFECT_DONE_BIT) != 0) {
        slot->flags_26 &= ~EFFECT_DONE_BIT; // Acknowledge and clear
        return true;                        // Phase done, proceed with combat resolution
    }
    return false; // Still animating, yield
}

/**
 * Applies healing value to target, clamping to Max HP and the hard 999 ceiling.
 * Corresponds to $91:9D16.
 */
void spell_heal_clamp_to_max_hp_999(uint16_t heal_amount) {
    uint16_t new_hp = g_target_hp + heal_amount;

    // 1. Clamp to target Max HP
    if (new_hp > g_max_hp) {
        new_hp = g_max_hp;
    }

    // 2. Enforce hard 999 ceiling
    if (new_hp > MAX_HP_CAP) {
        new_hp = MAX_HP_CAP;
    }

    g_target_hp = new_hp;
}
