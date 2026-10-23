/*
 * Routine: $8F8600 (level_growth)
 * Bank: $8F (ROM Offset: $0F8600)
 * Source: docs/disassembly/entities/level-growth.md
 */

#include <stdint.h>
#include <stdbool.h>

#define MAX_STAT_CAP 99
#define DOG_FORM_TOASTER 0x000C

extern const uint16_t g_base_growth_boy[32];   // $8C:90BF
extern const uint16_t g_base_growth_dog[32];   // $8C:90C9
extern const uint16_t g_base_attack_boy[32];   // $8C:8FE1
extern const uint16_t g_base_attack_dog[32];   // $8C:8FEB
extern const uint16_t g_weapon_modifiers[256]; // $C4:0000

extern uint16_t g_char_level;                  // $7E:0A91
extern uint16_t g_char_attack;                 // $7E:0A8F
extern uint16_t g_char_defense;                // $7E:0A8B
extern uint16_t g_char_magic_defense;          // $7E:0A89
extern uint16_t g_status_buff_flags;           // $7E:2261
extern uint16_t g_companion_dog_form;          // $7E:2363
extern uint16_t g_equipped_weapon_id;          // $7E:0ABE
extern uint16_t g_equip_bonus_level;           // $7E:4FDD
extern uint16_t g_equip_bonus_attack;          // $7E:4FDB

/**
 * Recalculates party character combat stats, applying level curves,
 * stat caps, weapon scaling, Atlas buffs, and dog form transformations.
 * Corresponds to $8F:8600.
 */
void character_stats_recalculate(bool is_dog, uint8_t char_index) {
    // 1. Compute Base Level with cap at 99
    uint16_t base_lvl = is_dog ? g_base_growth_dog[char_index] : g_base_growth_boy[char_index];
    uint16_t total_lvl = base_lvl + g_equip_bonus_level;
    g_char_level = (total_lvl > MAX_STAT_CAP) ? MAX_STAT_CAP : total_lvl;

    // 2. Compute Base Attack Power with cap at 99
    uint16_t base_atk = is_dog ? g_base_attack_dog[char_index] : g_base_attack_boy[char_index];
    uint16_t total_atk = base_atk + g_equip_bonus_attack;
    g_char_attack = (total_atk > MAX_STAT_CAP) ? MAX_STAT_CAP : total_atk;

    // 3. Compute Weapon Modifier & Atlas Buff (+6.25%)
    uint16_t weapon_mod = 0;
    if (g_equipped_weapon_id != 0) {
        weapon_mod = g_weapon_modifiers[g_equipped_weapon_id];
        if (g_status_buff_flags & 0x0020) { // Atlas buff bit
            weapon_mod += (weapon_mod >> 4);
        }
    }
    g_char_defense += weapon_mod;

    // 4. Toaster Dog Era Transformation Bonus
    if (g_companion_dog_form == DOG_FORM_TOASTER) {
        g_char_magic_defense += 80;  // +0x50 MDef
        g_char_defense       += 250; // +0xFA Defense
    }
}
