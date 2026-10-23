/*
 * Routine: $8F9210 (weapon_equip_buffs)
 * Bank: $8F (ROM Offset: $0F9210)
 * Source: docs/disassembly/combat/weapon-equip-buffs.md
 */

#include <stdint.h>
#include <stdbool.h>

#define MAX_BUFF_TYPES          16
#define WEAPON_CATEGORY_COUNT   13
#define DEFAULT_FULL_STAMINA    0x0400  /* 1024 = 100.0% charged */
#define LOCK_BIT_CHARGING       0x0800  /* Status word bit 11 */

/* ROM Lookup Tables (Bank $CC & $C4) */
extern const uint16_t g_buff_wram_offsets[MAX_BUFF_TYPES];  /* $CC:BBB0 */
extern const uint16_t g_buff_bitmasks[MAX_BUFF_TYPES];      /* $CC:BBD8 */

extern const uint16_t g_weapon_persistence_ptrs[14];        /* $C4:59A4 */
extern const uint16_t g_weapon_bitmasks[14];                /* $C4:59C0 */
extern const uint8_t  g_weapon_anim_modes[14];               /* $C4:59DC */

/* System WRAM State */
typedef struct {
    int16_t  buff_add_request;      /* $7E:243D: -1 if none */
    int16_t  buff_remove_request;   /* $7E:243F: -1 if none */
    int16_t  weapon_equip_request;  /* $7E:2441: -1=unequip, 0=none, >0=weapon_id */
    uint16_t active_weapon_id;      /* $7E:0ABA */
    uint16_t weapon_transition_flag;/* $7E:23BF */
    uint8_t  persistence_buffs[4];  /* $7E:2261..$7E:2263 */
    uint8_t  equipped_weapons[4];   /* $7E:22DA..$7E:22DD */
    uint16_t boy_stamina;           /* $7E:4EB7 */
    uint16_t dog_stamina;           /* $7E:4F65 */
    uint16_t boy_status_flags;      /* $7E:4E9B */
    uint16_t dog_status_flags;      /* $7E:4F49 */
    uint16_t weapon_base_might;     /* $7E:0A58 */
    uint16_t weapon_charged_might;  /* $7E:0A5A */
    uint16_t weapon_proc_might;     /* $7E:0A5C */
    uint16_t weapon_sprite_desc;    /* $7E:0A2F */
} EquipmentSystemState;

extern EquipmentSystemState g_equip_state;

/* External Subsystems */
extern void character_stat_recalculation_armor(void);      /* $8F:8398 */
extern void companion_stats_scaling_and_form_rebuild(void); /* $8F:857D */
extern void verify_actor_active_status(uint16_t actor_id);  /* $8F:9144 */
extern void sprite_slice_descriptor_composite(uint16_t desc_addr); /* $90:CF3A */

/**
 * Synchronizes active buff additions, debuff removals, weapon equips,
 * and primes 100% full charge stamina.
 * Corresponds to native routine $8F:9210.
 */
void equipment_weapon_equip_and_buff_sync(void) {
    bool stats_dirty = false;

    // 1. Process Buff Add Request ($7E:243D)
    if (g_equip_state.buff_add_request >= 0) {
        uint16_t buff_idx = (uint16_t)g_equip_state.buff_add_request;
        uint16_t offset = g_buff_wram_offsets[buff_idx];
        uint16_t mask = g_buff_bitmasks[buff_idx];

        uint16_t *dest = (uint16_t *)(&g_equip_state.persistence_buffs[offset]);
        *dest |= mask;

        g_equip_state.buff_add_request = -1; // Clear latch
        stats_dirty = true;
    }

    // 2. Process Buff Removal Request ($7E:243F)
    if (g_equip_state.buff_remove_request >= 0) {
        uint16_t buff_idx = (uint16_t)g_equip_state.buff_remove_request;
        uint16_t offset = g_buff_wram_offsets[buff_idx];
        uint16_t mask = g_buff_bitmasks[buff_idx];

        uint16_t *dest = (uint16_t *)(&g_equip_state.persistence_buffs[offset]);
        *dest &= ~mask;

        g_equip_state.buff_remove_request = -1; // Clear latch
        stats_dirty = true;
    }

    if (stats_dirty) {
        character_stat_recalculation_armor();
        companion_stats_scaling_and_form_rebuild();
        verify_actor_active_status(0x4E89); // Boy
        verify_actor_active_status(0x4F37); // Dog
    }

    // 3. Process Weapon Equip Request ($7E:2441)
    if (g_equip_state.weapon_equip_request != 0) {
        if (g_equip_state.weapon_equip_request < 0) {
            // Un-equip all weapons
            for (uint8_t i = 1; i <= WEAPON_CATEGORY_COUNT; i++) {
                uint16_t off = g_weapon_persistence_ptrs[i];
                uint16_t mask = g_weapon_bitmasks[i];
                uint16_t *dest = (uint16_t *)(&g_equip_state.equipped_weapons[off]);
                *dest &= ~mask;
            }
            g_equip_state.active_weapon_id = 0;
            g_equip_state.weapon_transition_flag = 1;
        } else {
            // Equip specified weapon
            uint16_t weapon_id = (uint16_t)g_equip_state.weapon_equip_request;
            uint16_t off = g_weapon_persistence_ptrs[weapon_id];
            uint16_t mask = g_weapon_bitmasks[weapon_id];
            uint16_t *dest = (uint16_t *)(&g_equip_state.equipped_weapons[off]);
            *dest |= mask;

            g_equip_state.active_weapon_id = weapon_id;
            g_equip_state.weapon_transition_flag = 1;
        }

        g_equip_state.weapon_equip_request = 0;
        character_stat_recalculation_armor();
    }

    // 4. Prime Stamina and Setup Weapon Parameters
    if (g_equip_state.weapon_transition_flag != 0) {
        g_equip_state.weapon_transition_flag = 0;

        // Populate Might Parameters
        g_equip_state.weapon_base_might    = 0x3EFE;
        g_equip_state.weapon_charged_might = 0x3F0E;
        g_equip_state.weapon_proc_might    = 0x3F1E;

        // Prime 100.0% Charge Stamina
        g_equip_state.boy_stamina = DEFAULT_FULL_STAMINA;
        g_equip_state.dog_stamina = DEFAULT_FULL_STAMINA;

        // Clear charging lock bits
        g_equip_state.boy_status_flags &= ~LOCK_BIT_CHARGING;
        g_equip_state.dog_status_flags &= ~LOCK_BIT_CHARGING;

        // Assemble weapon sprite slices
        g_equip_state.weapon_sprite_desc = 0xAD0B;
        sprite_slice_descriptor_composite(0xAD0B);
    }
}
