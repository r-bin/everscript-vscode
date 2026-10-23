/*
 * Routine: $91B632 (status_effects)
 * Bank: $91 (ROM Offset: $11B632)
 * Source: docs/disassembly/combat/status-effects.md
 */

#include <stdint.h>
#include <stdbool.h>

#define MAX_STATUS_SLOTS        4
#define STATUS_SLOT_EMPTY       0xFFFF
#define STATUS_FLAG_MOST_RECENT 0x8000

typedef enum {
    STATUS_TYPE_NONE    = 0,
    STATUS_TYPE_BUFF    = 1,
    STATUS_TYPE_AILMENT = 2
} StatusCategory;

typedef enum {
    STATUS_ATLAS   = 0x00,
    STATUS_BARRIER = 0x08,
    STATUS_DEFEND  = 0x10,
    STATUS_REFLECT = 0x18,
    STATUS_SPEED   = 0x20,
    STATUS_POISON  = 0x58,
    STATUS_CONFOUND= 0x60,
    STATUS_PLAGUE  = 0x68
} StatusId;

typedef struct {
    uint16_t status_id;         /* +0x00: $FFFF = empty, bit 15 = most recent */
    uint16_t timer;             /* +0x02: remaining ticks */
    uint16_t param_boost;       /* +0x04: stat modifier value */
} StatusSlot;

typedef struct {
    uint16_t entity_id;
    int16_t  hp;
    int16_t  max_hp;
    int16_t  attack_power;
    int16_t  defense_power;
    uint16_t state_flags;       /* +0x14 */
    uint8_t  outline_glow_bits; /* +0x9A */
    StatusSlot slots[MAX_STATUS_SLOTS]; /* +0x46, +0x4C, +0x52, +0x58 */
} CombatEntity;

typedef void (*StatusTickFunc)(CombatEntity *entity, StatusSlot *slot);
typedef void (*StatusCleanupFunc)(CombatEntity *entity, StatusSlot *slot, bool silent);

typedef struct {
    StatusTickFunc    tick_handler;
    StatusCleanupFunc cleanup_handler;
    uint8_t           outline_bit;
    uint8_t           category; /* 1 = buff, 2 = ailment */
} StatusDescriptor;

extern const StatusDescriptor g_status_table[32];
extern void dialogue_announce_status_wear_off(uint16_t status_id);
extern void entity_recalculate_stats(CombatEntity *entity);

/**
 * Reverts active status bonus, clears outline glow bit, and empties slot.
 * Corresponds to native routine $91:B9A7.
 */
void status_purge_slot(CombatEntity *entity, int slot_index, bool silent) {
    StatusSlot *slot = &entity->slots[slot_index];
    uint16_t raw_id = slot->status_id;
    if (raw_id == STATUS_SLOT_EMPTY) {
        return;
    }

    uint16_t clean_id = raw_id & ~STATUS_FLAG_MOST_RECENT;
    uint8_t table_index = (clean_id >> 3);

    /* 1. Execute status-specific cleanup (e.g. remove attack/defense bonus) */
    if (g_status_table[table_index].cleanup_handler != NULL) {
        g_status_table[table_index].cleanup_handler(entity, slot, silent);
    }

    /* 2. Clear outline glow bit */
    entity->outline_glow_bits &= ~(g_status_table[table_index].outline_bit);

    /* 3. Announce wear-off message if not silent */
    if (!silent) {
        dialogue_announce_status_wear_off(clean_id);
    }

    /* 4. Reset slot to empty */
    slot->status_id = STATUS_SLOT_EMPTY;
    slot->timer = 0;
    slot->param_boost = 0;

    /* 5. Recalculate derived character attributes */
    entity_recalculate_stats(entity);
}

/**
 * Executes per-frame countdown and effect ticking across all entity status slots.
 * Corresponds to native routine $91:BC28.
 */
void status_effects_tick_all(CombatEntity *entity) {
    for (int i = 0; i < MAX_STATUS_SLOTS; i++) {
        StatusSlot *slot = &entity->slots[i];
        if (slot->status_id == STATUS_SLOT_EMPTY) {
            continue;
        }

        uint16_t clean_id = slot->status_id & ~STATUS_FLAG_MOST_RECENT;
        uint8_t table_index = (clean_id >> 3);

        /* Decrement duration timer */
        if (slot->timer > 0) {
            slot->timer--;
            
            /* Run per-frame periodic tick */
            if (g_status_table[table_index].tick_handler != NULL) {
                g_status_table[table_index].tick_handler(entity, slot);
            }
        }

        /* Timer expiration triggers cleanup */
        if (slot->timer == 0) {
            status_purge_slot(entity, i, false /* announce wear-off */);
        }
    }
}

/**
 * Applies a status effect onto an entity, arbitrating refresh, empty slots, or eviction.
 * Accurately implements the fixed eviction logic (curing the vanilla 5-status effects bug).
 * Corresponds to native routine $91:B632.
 */
bool status_effect_apply(CombatEntity *entity, uint16_t new_status_id, uint16_t duration, uint16_t boost_param) {
    uint8_t new_table_idx = (new_status_id >> 3);
    uint8_t new_category = g_status_table[new_table_idx].category;

    /* Priority 1: Check for existing matching status to refresh */
    for (int i = 0; i < MAX_STATUS_SLOTS; i++) {
        if ((entity->slots[i].status_id & ~STATUS_FLAG_MOST_RECENT) == new_status_id) {
            entity->slots[i].timer = duration;
            entity->slots[i].param_boost = boost_param;
            return true;
        }
    }

    /* Priority 2: Occupy first available empty slot */
    for (int i = 0; i < MAX_STATUS_SLOTS; i++) {
        if (entity->slots[i].status_id == STATUS_SLOT_EMPTY) {
            /* Clear most recent flag on other slots */
            for (int j = 0; j < MAX_STATUS_SLOTS; j++) {
                entity->slots[j].status_id &= ~STATUS_FLAG_MOST_RECENT;
            }

            entity->slots[i].status_id = new_status_id | STATUS_FLAG_MOST_RECENT;
            entity->slots[i].timer = duration;
            entity->slots[i].param_boost = boost_param;
            entity->outline_glow_bits |= g_status_table[new_table_idx].outline_bit;
            entity_recalculate_stats(entity);
            return true;
        }
    }

    /* Priority 3: Evict first slot holding a buff that is NOT the most recent */
    for (int i = 0; i < MAX_STATUS_SLOTS; i++) {
        uint16_t slot_id = entity->slots[i].status_id;
        if ((slot_id & STATUS_FLAG_MOST_RECENT) == 0) {
            uint8_t slot_cat = g_status_table[(slot_id & ~STATUS_FLAG_MOST_RECENT) >> 3].category;
            if (slot_cat == STATUS_TYPE_BUFF) {
                /* Fix: Purge the EVICTED status (slot_id), not the incoming new_status_id! */
                status_purge_slot(entity, i, false /* announce eviction */);

                /* Assign new status into now-vacant slot */
                for (int j = 0; j < MAX_STATUS_SLOTS; j++) {
                    entity->slots[j].status_id &= ~STATUS_FLAG_MOST_RECENT;
                }
                entity->slots[i].status_id = new_status_id | STATUS_FLAG_MOST_RECENT;
                entity->slots[i].timer = duration;
                entity->slots[i].param_boost = boost_param;
                entity->outline_glow_bits |= g_status_table[new_table_idx].outline_bit;
                entity_recalculate_stats(entity);
                return true;
            }
        }
    }

    /* Priority 4: All slots filled with non-evictable statuses -> Cast fails */
    return false;
}
