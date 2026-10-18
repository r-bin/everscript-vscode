# Status Effect Timers, Buff Stacking & Eviction Subsystem

> **ROM Bank**: `$91` (Status Engine & Handlers)  
> **Source Routines**: `$91:B632` (`status_effect_apply`), `$91:BC28` (`status_effects_tick_all`), `$91:B7FA` (`status_cleanup_caller`), `$91:B9A7` (`status_purge_slot`)  
> **Master Jump Table**: `$91:AE31` (8 bytes per status entry: tick, cleanup, outline bit, type)  
> **Entity Layout**: 4 status slots per entity at `+$46`, `+$4C`, `+$52`, `+$58` (6 bytes per slot: ID, Timer, Boost Param)  
> **Memory Map**: `$7E:15D2` (Silent cleanup flag, `$FFFF` = silent), `$7E:0FB2` (Active status tick counter), direct page `$60` (timer ptr), `$62` (param ptr)

---

## 1. Architectural Overview

Every combat entity in *Secret of Evermore* possesses **four dedicated status effect slots** in its character record. These slots manage both beneficial buffs (Atlas, Barrier, Defend, Reflect, Speed, etc.) and harmful ailments (Poison, Confound, Plague, Stun):

| Slot | Offset | ID Field | Timer Field | Parameter / Boost Field |
|---|---|---|---|---|
| **Slot 1** | `+$46` | `+0x00` (`+$46`) | `+0x02` (`+$48`) | `+0x04` (`+$4A`) |
| **Slot 2** | `+$4C` | `+0x00` (`+$4C`) | `+0x02` (`+$4E`) | `+0x04` (`+$50`) |
| **Slot 3** | `+$52` | `+0x00` (`+$52`) | `+0x02` (`+$54`) | `+0x04` (`+$56`) |
| **Slot 4** | `+$58` | `+0x00` (`+$58`) | `+0x02` (`+$5A`) | `+0x04` (`+$5C`) |

A slot is empty when its ID is `$FFFF`. Bit 15 of the status ID indicates the most recently applied status on that entity.

### Key Subsystems:
1. **Per-Frame Tick Dispatcher (`$91:BC28`)**:
   - Each frame during active gameplay, the engine iterates over all 4 status slots for active entities.
   - Non-empty slots decrement their 16-bit countdown timer.
   - Dispatches execution through master jump table `$91:AE31,X` based on status ID.
   - When a timer expires, execution falls directly into that status's cleanup handler.
2. **Status Application & Eviction Priority (`$91:B632`)**:
   - When a spell or item inflicts a status effect, the engine searches the 4 slots in strict priority:
     1. **Refresh**: If a slot already holds the *same* status ID, the timer is refreshed to max.
     2. **Empty Slot**: If any slot is `$FFFF`, the status occupies the empty slot.
     3. **Eviction**: If all slots are full, the engine selects the *first slot holding a buff that is not the most recent*.
     4. **Failure**: If no eligible slot can be evicted, the status application fails.
3. **The Vanilla "5 Status Effects" Bug (`$91:B7FA`)**:
   - During eviction, `$91:B7FA` is supposed to clean up the displaced status before overwriting it.
   - However, the vanilla code loaded `LDX $02` (which held the **new** incoming status ID) rather than the evicted status ID!
   - As a result, the old buff's stat boosts (e.g. Atlas attack multiplier) and outline glow were never reverted, remaining permanently stacked on the character.
4. **Cleanup Protocol (`$91:B9A7`)**:
   - Reverts stat modifications (e.g. subtracts boost from base stats, recalculates derived attributes via `$8F:8398`).
   - Clears the character's outline glow bit in `$9A,X` via `$90:C9B2`.
   - Clears the slot to `$FFFF` and zeroes the timer and parameter fields.
   - If `$15D2 == 0`, prints "*... has worn off*" message via `$8C:C521`.

---

## 2. 65816 Assembly Implementation

```assembly
; ==============================================================================
; $91:BC28 - Per-Frame Status Effect Dispatcher
; Y = Entity pointer; direct page $60 = timer ptr, $62 = param ptr
; ==============================================================================
status_effects_tick_all:
    INC $0FB2                   ; Increment tick counter
    AND #$7FFF                  ; Strip recency flag (bit 15)
    TAX
    JMP ($AE31,X)               ; Jump to status-specific tick handler in table

; ==============================================================================
; $91:B632 - Status Effect Application & Slot Arbitrator
; Input: X = New status ID; Y = Target entity pointer
; ==============================================================================
status_effect_apply:
    PHB
    PEA $7E7E
    PLB
    PLB
    STX $02                     ; Save requested status ID in $02
    STZ $16
    LDA #$0001
    STA $0FB2

    ; Scan Slot 1 ($0046,Y)
    LDX $0046,Y
    CPX #$FFFF
    BEQ .found_empty_slot_1
    BMI .check_matching_1
    ; [Scans remaining slots 2, 3, 4 for match, empty, or oldest buff]
    ; ...
.found_empty_slot_1:
    ; Staged write to slot...
    PLB
    RTL

; ==============================================================================
; $91:B7FA - Slot Cleanup Invocation (Vanilla Bug Location)
; ==============================================================================
status_slot_cleanup_caller:
    STA $60                     ; Timer pointer
    INC A
    INC A
    STA $62                     ; Param pointer
    LDX $02                     ; <-- VANILLA BUG: Loads new ID ($02) instead of slot ID!
    PHY
    PHX
    LDA #$FFFF
    STA $15D2                   ; Set silent flag ($FFFF = no on-screen message)
    JSR ($AE33,X)               ; Jump to cleanup handler
    STZ $15D2
    PLX
    PLY
    STX $02
    RTS
```

---

## 3. Clean C Decompilation

```c
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
```
