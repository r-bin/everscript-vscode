/*
 * Routine: $8E8F50 (weapon_select)
 * Bank: $8E (ROM Offset: $0E8F50)
 * Source: docs/disassembly/ui/weapon-select.md
 */

#include <stdint.h>
#include <stdbool.h>

#define MAX_WEAPON_CLASSES      4    /* Sword, Axe, Spear, Bazooka */
#define MAX_WEAPONS_PER_CLASS   4    /* 4 tiers per weapon class */
#define SFX_WEAPON_EQUIP        0x0043
#define RING_MENU_ERROR_BUZZ    0x0020

typedef enum {
    WEAPON_TYPE_SWORD   = 0,
    WEAPON_TYPE_AXE     = 1,
    WEAPON_TYPE_SPEAR   = 2,
    WEAPON_TYPE_BAZOOKA = 3
} WeaponType;

typedef struct {
    uint8_t  weapon_id;
    uint8_t  tier;              /* Tier 1, 2, 3, or 4 */
    uint16_t attack_bonus;
    uint16_t current_xp;        /* Range: 0..999 */
    uint8_t  skill_level;       /* Range: Level 0..3 */
    bool     unlocked;
} WeaponRecord;

typedef struct {
    uint8_t      equipped_weapon_id; /* $7E:231C */
    uint16_t     equipped_xp;        /* $7E:0AC6 */
    uint8_t      equipped_level;     /* $7E:0AC8 */
    uint16_t     system_flags;       /* $7E:05A9 */
    WeaponRecord inventory[MAX_WEAPON_CLASSES * MAX_WEAPONS_PER_CLASS];
} PlayerWeaponState;

extern void play_sound_effect_direct(uint16_t sfx_id);
extern void update_hud_weapon_display(uint8_t weapon_id, uint8_t level);

/**
 * Validates selected weapon from the ring menu and equips it.
 * Corresponds to native routines $8E:8F50 and $8E:9000.
 */
bool ring_menu_equip_weapon(PlayerWeaponState *player, uint8_t weapon_slot_index) {
    if (weapon_slot_index >= (MAX_WEAPON_CLASSES * MAX_WEAPONS_PER_CLASS)) {
        player->system_flags |= RING_MENU_ERROR_BUZZ;
        return false;
    }

    WeaponRecord *weapon = &player->inventory[weapon_slot_index];

    /* Step 1: Ownership Check */
    if (!weapon->unlocked) {
        player->system_flags |= RING_MENU_ERROR_BUZZ; /* Play error buzz */
        return false;
    }

    /* Step 2: Skip redundant swap if already equipped */
    if (player->equipped_weapon_id == weapon->weapon_id) {
        return true;
    }

    /* Step 3: Equip weapon and transfer active skill levels */
    player->equipped_weapon_id = weapon->weapon_id;
    player->equipped_xp = weapon->current_xp;
    player->equipped_level = weapon->skill_level;

    /* Step 4: Play confirmation clink sound ($0043) */
    play_sound_effect_direct(SFX_WEAPON_EQUIP);

    /* Step 5: Refresh HUD Roman numerals and weapon icons */
    update_hud_weapon_display(weapon->weapon_id, weapon->skill_level);
    return true;
}
