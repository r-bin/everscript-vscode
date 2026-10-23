/*
 * Routine: $8FCD17 (enemy_ai)
 * Bank: $8F (ROM Offset: $0FCD17)
 * Source: docs/disassembly/entities/enemy-ai.md
 */

#include <stdint.h>
#include <stdbool.h>
#include <stdlib.h>

#define STAMINA_FULL            0x0400  /* 1024 points = 100% full charge */

/* Entity offsets */
#define ENT_OFF_FLAGS_14        0x14
#define ENT_OFF_POS_X           0x1A
#define ENT_OFF_POS_Y           0x1C
#define ENT_OFF_TARGET_PTR      0x24
#define ENT_OFF_HP              0x2A
#define ENT_OFF_CHARGE_SPEED    0x2C
#define ENT_OFF_STAMINA         0x2E
#define ENT_OFF_SPAWN_X         0x3E
#define ENT_OFF_LEASH_RADIUS    0x40
#define ENT_OFF_CHAR_RECORD     0x60
#define ENT_OFF_ACTION_STATE    0x78

/* Character record offsets in ROM Bank $8E */
#define CHAR_OFF_BEHAVIOR       0x03
#define CHAR_OFF_AGGRO_RANGE    0x13
#define CHAR_OFF_AGGRO_CHANCE   0x15

typedef struct {
    uint16_t x, y;
    uint16_t hp;
} PlayerTarget;

/**
 * AI behavior function signature.
 */
typedef void (*AIBehaviorFunc)(uint16_t entity_ptr);

extern void enemy_ai_roaming_chaser(uint16_t entity_ptr);
extern void enemy_ai_stationary_turret(uint16_t entity_ptr);

static const AIBehaviorFunc g_ai_jump_table[15] = {
    [0x00] = enemy_ai_roaming_chaser,     // 0: Standard roaming monster (53 enemies)
    [0x01] = NULL,                         // 2: Static props / boss parts ($8FD76A)
    [0x02] = NULL,                         // 4: Boy companion AI ($8FD05E)
    [0x03] = NULL,                         // 6: Dog companion AI ($8FD0A8)
    [0x04] = enemy_ai_stationary_turret,   // 8: Stationary turret / plant ($8FD6FB)
    /* Indices 5..14 cover Bosses, NPCs, Hazards */
};

/**
 * Master enemy AI dispatcher called every frame ($8F:CD17).
 *
 * @param entity_ptr WRAM address of the active entity.
 */
void enemy_ai_dispatcher(uint16_t entity_ptr) {
    uint16_t char_record = read_wram16(entity_ptr + ENT_OFF_CHAR_RECORD);
    uint16_t behavior_word = read_rom16(0x8E0000 + char_record + CHAR_OFF_BEHAVIOR);

    uint8_t table_index = (behavior_word >> 1) & 0x0F;
    if (g_ai_jump_table[table_index]) {
        g_ai_jump_table[table_index](entity_ptr);
    }
}

/**
 * Evaluates whether an enemy detects and locks onto a player character ($8F:D69B).
 *
 * @param entity_ptr WRAM address of the enemy entity.
 * @param boy_ptr    WRAM address of the Boy ($7E:0F3E).
 * @param dog_ptr    WRAM address of the Dog ($7E:0F40).
 * @return True if a target was acquired and stored in entity +0x24.
 */
bool enemy_ai_check_aggro(uint16_t entity_ptr, uint16_t boy_ptr, uint16_t dog_ptr) {
    /* 1. Stamina check: Must have >= 100% stamina to initiate aggro */
    uint16_t stamina = read_wram16(entity_ptr + ENT_OFF_STAMINA);
    if (stamina < STAMINA_FULL) {
        return false;
    }

    /* 2. Aggro dice roll */
    uint16_t char_record = read_wram16(entity_ptr + ENT_OFF_CHAR_RECORD);
    uint8_t aggro_chance = read_rom8(0x8E0000 + char_record + CHAR_OFF_AGGRO_CHANCE);
    uint8_t roll = (uint8_t)(snes_rng_next() & 0xFF);
    if (roll >= aggro_chance) {
        return false;
    }

    /* 3. Proximity evaluations against Boy and Dog */
    uint16_t aggro_range = read_rom16(0x8E0000 + char_record + CHAR_OFF_AGGRO_RANGE);
    int16_t ex = (int16_t)read_wram16(entity_ptr + ENT_OFF_POS_X);
    int16_t ey = (int16_t)read_wram16(entity_ptr + ENT_OFF_POS_Y);

    const uint16_t targets[2] = { boy_ptr, dog_ptr };
    for (int i = 0; i < 2; i++) {
        uint16_t t_ptr = targets[i];
        if (!t_ptr) continue;

        uint16_t hp = read_wram16(t_ptr + ENT_OFF_HP);
        if (hp == 0) continue; // Ignore dead party member

        int16_t tx = (int16_t)read_wram16(t_ptr + ENT_OFF_POS_X);
        int16_t ty = (int16_t)read_wram16(t_ptr + ENT_OFF_POS_Y);

        int16_t dx = abs(tx - ex);
        int16_t dy = abs(ty - ey);

        if (dx < (int16_t)aggro_range && dy < (int16_t)aggro_range) {
            // Target acquired!
            write_wram16(entity_ptr + ENT_OFF_TARGET_PTR, t_ptr);
            enemy_face_towards(entity_ptr, tx, ty);
            write_wram16(entity_ptr + ENT_OFF_ACTION_STATE, 0x0001 /* Alert / Attack */);
            return true;
        }
    }

    return false;
}

/**
 * Standard Roaming / Chasing Monster AI loop ($8F:D34B).
 *
 * @param entity_ptr WRAM address of the enemy entity.
 */
void enemy_ai_roaming_chaser(uint16_t entity_ptr) {
    uint16_t target_ptr = read_wram16(entity_ptr + ENT_OFF_TARGET_PTR);

    if (target_ptr == 0) {
        /* No active target: evaluate aggro detection */
        uint16_t boy_ptr = read_wram16(0x0F3E);
        uint16_t dog_ptr = read_wram16(0x0F40);
        if (enemy_ai_check_aggro(entity_ptr, boy_ptr, dog_ptr)) {
            return;
        }

        /* Still idle: patrol within spawn leash radius (+0x40) */
        enemy_patrol_leash(entity_ptr);
    } else {
        /* Target locked: verify target is still alive and within leash boundary */
        uint16_t target_hp = read_wram16(target_ptr + ENT_OFF_HP);
        if (target_hp == 0 || enemy_exceeded_leash(entity_ptr)) {
            // Target lost or disengaged: drop target
            write_wram16(entity_ptr + ENT_OFF_TARGET_PTR, 0);
            return;
        }

        /* Advance towards target or initiate stamina attack */
        int16_t tx = (int16_t)read_wram16(target_ptr + ENT_OFF_POS_X);
        int16_t ty = (int16_t)read_wram16(target_ptr + ENT_OFF_POS_Y);
        int16_t ex = (int16_t)read_wram16(entity_ptr + ENT_OFF_POS_X);
        int16_t ey = (int16_t)read_wram16(entity_ptr + ENT_OFF_POS_Y);

        if (abs(tx - ex) < 24 && abs(ty - ey) < 24) {
            // Melee range: trigger attack animation and empty stamina
            trigger_enemy_attack(entity_ptr);
        } else {
            // Step along vector towards target
            enemy_step_towards(entity_ptr, tx, ty);
        }
    }
}

/**
 * Stationary Turret / Plant AI loop ($8F:D6FB).
 *
 * @param entity_ptr WRAM address of the enemy entity.
 */
void enemy_ai_stationary_turret(uint16_t entity_ptr) {
    uint16_t target_ptr = read_wram16(entity_ptr + ENT_OFF_TARGET_PTR);

    if (target_ptr == 0) {
        uint16_t boy_ptr = read_wram16(0x0F3E);
        uint16_t dog_ptr = read_wram16(0x0F40);
        enemy_ai_check_aggro(entity_ptr, boy_ptr, dog_ptr);
    } else {
        uint16_t target_hp = read_wram16(target_ptr + ENT_OFF_HP);
        if (target_hp == 0) {
            write_wram16(entity_ptr + ENT_OFF_TARGET_PTR, 0);
            return;
        }

        // Immobile: orient towards target and fire ranged projectile or strike
        int16_t tx = (int16_t)read_wram16(target_ptr + ENT_OFF_POS_X);
        int16_t ty = (int16_t)read_wram16(target_ptr + ENT_OFF_POS_Y);
        enemy_face_towards(entity_ptr, tx, ty);
        trigger_enemy_turret_attack(entity_ptr);
    }
}
