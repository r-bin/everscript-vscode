/*
 * Routine: $8F857D (companion_form_stats)
 * Bank: $8F (ROM Offset: $0F857D)
 * Source: docs/disassembly/entities/companion-form-stats.md
 */

#include <stdint.h>
#include <stdbool.h>

#define MAX_DOG_LEVEL         99
#define STAT_MAX_HP_LIMIT     999
#define STAT_CLAMP_99         99

#define FORM_TOASTER_DOG      0x000C
#define TOASTER_BONUS_MDEF    80
#define TOASTER_BONUS_PDEF    250

/* Passive Alchemy Charms */
#define CHARM_CHOCOBO_EGG     0x0040  /* $7E:2261 bit 6: +25% Max HP */
#define CHARM_COLLAR_POLISH   0x0020  /* $7E:2261 bit 5: +25% Collar Defense */
#define CHARM_ARMOR_POLISH    0x0080  /* $7E:2262 bit 7: Boost Defense */
#define CHARM_ACCURACY        0x0001  /* $7E:2262 bit 0: Boost Hit Rate */
#define CHARM_MAGIC_DEFENSE   0x0001  /* $7E:2263 bit 0: Boost Magic Defense */
#define CHARM_ATLAS           0x0002  /* $7E:2263 bit 1: Boost Attack Power */
#define CHARM_EVADE           0x0004  /* $7E:2263 bit 2: Boost Evade */

/* ROM Tables (Bank $8C & $C4) */
extern const uint16_t g_dog_hp_base[MAX_DOG_LEVEL];        /* $8C:9515 */
extern const uint16_t g_dog_hp_chocobo[MAX_DOG_LEVEL];     /* $8C:951F */
extern const uint16_t g_dog_mdef_base[MAX_DOG_LEVEL];      /* $8C:96D1 */
extern const uint16_t g_dog_mdef_boosted[MAX_DOG_LEVEL];   /* $8C:96DB */
extern const uint16_t g_dog_pdef_base[MAX_DOG_LEVEL];      /* $8C:95F3 */
extern const uint16_t g_dog_pdef_boosted[MAX_DOG_LEVEL];   /* $8C:95FD */
extern const uint16_t g_dog_evade_base[MAX_DOG_LEVEL];     /* $8C:97AF */
extern const uint16_t g_dog_evade_boosted[MAX_DOG_LEVEL];  /* $8C:97B9 */
extern const uint16_t g_dog_hit_base[MAX_DOG_LEVEL];        /* $8C:90BF */
extern const uint16_t g_dog_hit_boosted[MAX_DOG_LEVEL];     /* $8C:90C9 */
extern const uint16_t g_dog_atk_base[MAX_DOG_LEVEL];        /* $8C:8FE1 */
extern const uint16_t g_dog_atk_boosted[MAX_DOG_LEVEL];     /* $8C:8FEB */
extern const uint16_t g_armor_collar_defense[256];          /* $C4:0000 */

/* WRAM State */
typedef struct {
    uint16_t dog_level;         /* $7E:0A9A: 0..98 */
    uint16_t dog_max_hp;        /* $7E:0A7F */
    uint16_t dog_current_hp;    /* $7E:4F61 */
    uint16_t dog_mdef;          /* $7E:0A89 */
    uint16_t dog_pdef;          /* $7E:0A8B */
    uint16_t dog_evade;         /* $7E:0A8D */
    uint16_t dog_hit_rate;      /* $7E:0A91 */
    uint16_t dog_attack;        /* $7E:0A8F */
    uint16_t equipped_collar;   /* $7E:0ABE */
    uint16_t dog_form;          /* $7E:2363: 0=wolf, 1=poodle, 12=toaster */
    uint16_t charms_byte1;      /* $7E:2261 */
    uint16_t charms_byte2;      /* $7E:2262 */
    uint16_t charms_byte3;      /* $7E:2263 */
    uint16_t gear_bonus_mdef;   /* $7E:4FD7 */
    uint16_t gear_bonus_pdef;   /* $7E:4FD9 */
    uint16_t gear_bonus_atk;    /* $7E:4FDB */
    uint16_t gear_bonus_hit;    /* $7E:4FDD */
    uint16_t gear_bonus_evade;  /* $7E:4FDF */
} CompanionStatState;

extern CompanionStatState g_companion_state;

/**
 * Recalculates all combat statistics for the Dog companion.
 * Integrates level curves, charms, collar armor, and Toaster Dog epoch form.
 * Corresponds to native routine $8F:857D.
 */
void companion_stats_scaling_and_form_rebuild(void) {
    uint16_t lvl = g_companion_state.dog_level;
    if (lvl >= MAX_DOG_LEVEL) {
        lvl = MAX_DOG_LEVEL - 1;
    }

    // 1. Max HP
    bool has_egg = (g_companion_state.charms_byte1 & CHARM_CHOCOBO_EGG) != 0;
    uint16_t hp = has_egg ? g_dog_hp_chocobo[lvl] : g_dog_hp_base[lvl];
    if (hp > STAT_MAX_HP_LIMIT) {
        hp = STAT_MAX_HP_LIMIT;
    }
    g_companion_state.dog_max_hp = hp;
    if (g_companion_state.dog_current_hp > hp) {
        g_companion_state.dog_current_hp = hp;
    }

    // 2. Magic Defense
    bool has_mdef_charm = (g_companion_state.charms_byte3 & CHARM_MAGIC_DEFENSE) != 0;
    uint16_t mdef = has_mdef_charm ? g_dog_mdef_boosted[lvl] : g_dog_mdef_base[lvl];
    g_companion_state.dog_mdef = mdef + g_companion_state.gear_bonus_mdef;

    // 3. Physical Defense
    bool has_armor_polish = (g_companion_state.charms_byte2 & CHARM_ARMOR_POLISH) != 0;
    uint16_t pdef = has_armor_polish ? g_dog_pdef_boosted[lvl] : g_dog_pdef_base[lvl];
    g_companion_state.dog_pdef = pdef + g_companion_state.gear_bonus_pdef;

    // 4. Evade
    bool has_evade_charm = (g_companion_state.charms_byte3 & CHARM_EVADE) != 0;
    uint16_t evade = has_evade_charm ? g_dog_evade_boosted[lvl] : g_dog_evade_base[lvl];
    g_companion_state.dog_evade = evade + g_companion_state.gear_bonus_evade;

    // 5. Hit Rate (capped at 99)
    bool has_hit_charm = (g_companion_state.charms_byte2 & CHARM_ACCURACY) != 0;
    uint16_t hit = has_hit_charm ? g_dog_hit_boosted[lvl] : g_dog_hit_base[lvl];
    hit += g_companion_state.gear_bonus_hit;
    if (hit > STAT_CLAMP_99) {
        hit = STAT_CLAMP_99;
    }
    g_companion_state.dog_hit_rate = hit;

    // 6. Attack Power (capped at 99)
    bool has_atlas = (g_companion_state.charms_byte3 & CHARM_ATLAS) != 0;
    uint16_t atk = has_atlas ? g_dog_atk_boosted[lvl] : g_dog_atk_base[lvl];
    atk += g_companion_state.gear_bonus_atk;
    if (atk > STAT_CLAMP_99) {
        atk = STAT_CLAMP_99;
    }
    g_companion_state.dog_attack = atk;

    // 7. Collar Armor Addition
    uint16_t collar_id = g_companion_state.equipped_collar;
    if (collar_id > 0) {
        uint16_t collar_def = g_armor_collar_defense[collar_id];
        if (g_companion_state.charms_byte1 & CHARM_COLLAR_POLISH) {
            collar_def += (collar_def >> 4); // +25% bonus
        }
        g_companion_state.dog_pdef += collar_def;
    }

    // 8. Toaster Dog Transformation Bonus
    if (g_companion_state.dog_form == FORM_TOASTER_DOG) {
        g_companion_state.dog_mdef += TOASTER_BONUS_MDEF;
        g_companion_state.dog_pdef += TOASTER_BONUS_PDEF;
    }
}
