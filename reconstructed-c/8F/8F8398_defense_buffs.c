/*
 * Routine: $8F8398 (defense_buffs)
 * Bank: $8F (ROM Offset: $0F8398)
 * Source: docs/disassembly/combat/defense-buffs.md
 */

#include <stdint.h>
#include <stdbool.h>

#define MAX_HP_CAP 999

extern uint16_t g_max_hp;               // $7E:0A35
extern uint16_t g_current_hp;           // $7E:4EB3
extern uint16_t g_evade;                // $7E:0A3F
extern uint16_t g_magic_defense;        // $7E:0A41
extern uint16_t g_magic_evade;          // $7E:0A43
extern uint16_t g_critical_rate;        // $7E:0A45
extern uint16_t g_buff_flags_1;         // $7E:2261
extern uint16_t g_buff_flags_2;         // $7E:2262
extern uint16_t g_buff_flags_3;         // $7E:2263
extern uint8_t  g_bazooka_ammo_id;      // $7E:2349
extern uint16_t g_equipped_gear_slot;   // $7E:0ABE
extern uint16_t g_active_weapon_type;   // $7E:2441

extern uint16_t g_gear_bonus_evade;     // $7E:4F29
extern uint16_t g_gear_bonus_mdef;      // $7E:4F2B
extern uint16_t g_gear_bonus_mevade;    // $7E:4F31
extern uint16_t g_gear_bonus_crit;      // $7E:4F37

extern const uint16_t g_hp_std[32];     // $8C:919D
extern const uint16_t g_hp_boosted[32]; // $8C:91A7
extern const uint16_t g_mdef_std[32];   // $8C:927B
extern const uint16_t g_mdef_boost[32]; // $8C:9285
extern const uint16_t g_mevade_std[32]; // $8C:9437
extern const uint16_t g_mevade_boost[32];// $8C:9445
extern const uint16_t g_crit_std[32];   // $8C:8F03
extern const uint16_t g_crit_boost[32]; // $8C:8F0D
extern const uint16_t g_gear_properties[64]; // $C4:3894

extern void play_sound_effect_direct(uint16_t sfx_id);
extern void refresh_hud_stat_blocks(void);

/**
 * Recomputes all defensive attributes, clamping Max HP to 999
 * and evaluating Barrier, Defender, Reflect, and Speed status buffs.
 * Corresponds to $8F:8398.
 */
void character_defense_and_buff_rebuild(uint8_t weapon_idx) {
    // 1. Max HP calculation with Defender buff
    bool has_defender = (g_buff_flags_1 & 0x0040) != 0;
    uint16_t base_hp = has_defender ? g_hp_boosted[weapon_idx] : g_hp_std[weapon_idx];
    g_max_hp = (base_hp > MAX_HP_CAP) ? MAX_HP_CAP : base_hp;

    // Clamp active HP if current HP exceeds the new ceiling
    if (g_current_hp > g_max_hp) {
        g_current_hp = g_max_hp;
    }

    // 2. Physical Evade
    g_evade = g_gear_bonus_evade;

    // 3. Magic Defense with Barrier buff
    bool has_barrier = (g_buff_flags_2 & 0x0080) != 0;
    uint16_t base_mdef = has_barrier ? g_mdef_boost[weapon_idx] : g_mdef_std[weapon_idx];
    g_magic_defense = base_mdef + g_gear_bonus_mdef;

    // 4. Magic Evade with Reflect buff
    bool has_reflect = (g_buff_flags_3 & 0x0004) != 0;
    uint16_t base_mevade = has_reflect ? g_mevade_boost[weapon_idx] : g_mevade_std[weapon_idx];
    g_magic_evade = base_mevade + g_gear_bonus_mevade;

    // 5. Critical Rate with Speed buff
    bool has_speed = (g_buff_flags_2 & 0x0001) != 0;
    uint16_t base_crit = has_speed ? g_crit_boost[weapon_idx] : g_crit_std[weapon_idx];
    g_critical_rate = base_crit + g_gear_bonus_crit;
}

/**
 * Equips or toggles unequip of armor/weapon gear from ring menu.
 * Corresponds to $8E:922C.
 */
void ring_menu_gear_toggle_equip(uint8_t item_subindex) {
    play_sound_effect_direct(0x0012);

    uint16_t new_gear = g_gear_properties[item_subindex];

    // Toggle unequip if already wearing the selected gear
    if (g_equipped_gear_slot == new_gear) {
        g_equipped_gear_slot = 0; // Unequip
    } else {
        g_equipped_gear_slot = new_gear; // Equip
    }

    // Rebuild defensive stats and sync HUD
    character_defense_and_buff_rebuild(0);
    refresh_hud_stat_blocks();
}

/**
 * Selects active Bazooka ammo type (Thunder Ball, Particle Bomb, Cryo-Blast).
 * Corresponds to $8E:9200.
 */
void ring_menu_bazooka_ammo_select(uint8_t ammo_id) {
    g_bazooka_ammo_id = ammo_id;
    g_active_weapon_type = 0x001A; // Bazooka weapon ID
}
