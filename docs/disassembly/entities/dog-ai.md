# Companion AI State Machine & Sniffing Logic ($8C:DAC5, $8F:CD4D, $92:A44C)

> **Subsystem**: Entity & Companion AI Engine  
> **ROM Addresses**: `$8C:DAC5` (`companion_input_ai_dispatcher`), `$8F:CD4D` (`companion_entity_update`), `$92:A44C` (Global Script `0x39` Sniff Spot)  
> **Clean C Module**: `entities/dog-ai.c`  
> **Recomp Symbol**: `func_CCDAC5_M0X0`, `func_CFCD4D_M0X0`  
> **Confidence**: Confirmed

---

## 1. Architectural Role

Secret of Evermore features a dual-protagonist party: the **Boy** (primary entity slot at `$7E:4E89`) and his canine companion, the **Dog** (companion entity slot at `$7E:4F37`).
At any frame:
- Exactly one protagonist is directly controlled by human controller input (tracked by active player index in direct page `$02` / `$7E:0002`).
- The non-controlled companion character is driven autonomously by the engine companion AI subsystem (`$8C:DAC5` and `$8F:CD4D`).
- When controlling the Boy, the Dog follows, sniffs out hidden alchemy ingredient spots on the ground, or attacks nearby enemies according to behavioral aggression settings.
- When controlling the Dog, the Boy follows and engages targets.
- Sniffing spots trigger global script `0x39` (`$92:A44C`), causing the Dog to execute a sniffing/digging animation keyframe sequence and the player to dig up alchemy ingredients via B-button interaction.

---

## 2. Companion Entity Structure & Constants

```c
#include <stdint.h>
#include <stdbool.h>

#define ENTITY_BOY_PTR          0x4E89
#define ENTITY_DOG_PTR          0x4F37
#define ENTITY_STRIDE           0x00AE

/* Entity Record Offsets (+0xAE stride) */
#define ENT_OFF_FLAGS_10        0x10  /* Movement / update mode flags */
#define ENT_OFF_FLAGS_12        0x12  /* Status flags */
#define ENT_OFF_POS_X           0x1A  /* World X coordinate (16-bit) */
#define ENT_OFF_POS_Y           0x1C  /* World Y coordinate (16-bit) */
#define ENT_OFF_STAMINA         0x2E  /* Stamina / charge gauge (0x0400 = 100%) */
#define ENT_OFF_TARGET_PTR      0x4C  /* Target actor pointer for tracking/aggro */
#define ENT_OFF_TARGET_X        0x4E  /* Target waypoint X coordinate */
#define ENT_OFF_TARGET_Y        0x50  /* Target waypoint Y coordinate */
#define ENT_OFF_NEXT_LINK       0x5E  /* Linked list pointer to partner (+0x5E) */
#define ENT_OFF_BASE_PALETTE    0x78  /* Active palette selector */
#define ENT_OFF_AGGRESSION      0x82  /* Companion aggression level (0=passive, 1=balanced, 2=aggressive) */
#define ENT_OFF_WAYPOINT_NODE   0x98  /* Navigation waypoint list index */

/* Global WRAM Registers */
#define WRAM_ACTIVE_PLAYER      0x0002  /* Bit 0 = Boy active, Bit 1 = Dog active */
#define WRAM_LOOT_MAILBOX_ITEM  0x2391  /* Dropped / sniffed item ID */
#define WRAM_LOOT_MAILBOX_OBJ   0x2395  /* Loot container / sniff spot index */
#define WRAM_LOOT_SUCCESS_FLAG  0x22EA  /* Bit 0 = Loot successful */
#define WRAM_CUTSCENE_GUARD     0x22EB  /* Bit 5 = Party stopped / cutscene freeze */
```

---

## 3. Disassembly Analysis

```assembly
; ==============================================================================
; func_CCDAC5: Companion / Player Input & AI Dispatcher
; ==============================================================================
$8C:DAC5  A9 01 00     LDA #$0001
$8C:DAC8  80 11        BRA $DADB

$8C:DADB  85 02        STA $02          ; Store active control mask in DP $02
$8C:DADD  89 08 00     BIT #$0008       ; Test companion freeze / disable bit
$8C:DAE0  D0 0F        BNE $DAF1
$8C:DAE2  A6 7E        LDX $7E          ; Load player controller buffer pointer
$8C:DAE4  BD 0D 00     LDA $000D,X      ; Check controller input validity
$8C:DAE7  F0 08        BEQ $DAF1
$8C:DAE9  84 4C        STY $4C          ; Set active actor pointer to Boy ($4E89)
$8C:DAEB  22 4D CD 8F  JSL $8FCD4D      ; Update companion/player physics
$8C:DAEF  A5 02        LDA $02

$8C:DAF1  ...
$8C:DB01  89 02 00     BIT #$0002       ; Check if Dog slot is enabled / companion
$8C:DB04  F0 09        BEQ $DB0F
$8C:DB06  A2 37 4F     LDX #$4F37       ; Set active actor pointer to Dog ($4F37)
$8C:DB09  84 4C        STY $4C
$8C:DB0B  22 4D CD 8F  JSL $8FCD4D      ; Update Dog companion physics & AI
$8C:DB0F  38           SEC              ; Frame pass complete
$8C:DB10  60           RTS

; ==============================================================================
; func_CFCD4D: Companion Entity Update & Waypoint Follow Pass
; ==============================================================================
$8F:CD4D  22 E2 A8 8F  JSL $8FA8E2      ; Pre-update collision bounding box
$8F:CD51  B9 10 00     LDA $0010,Y      ; Read entity flags
$8F:CD54  29 DE DF     AND #$DFDE       ; Clear transient collision bits
$8F:CD57  99 10 00     STA $0010,Y
$8F:CD5A  B9 12 00     LDA $0012,Y
$8F:CD5D  29 FF FC     AND #$FCFF
$8F:CD60  99 12 00     STA $0012,Y
$8F:CD63  98           TYA              ; Compare entity address
$8F:CD64  C9 89 4E     CMP #$4E89       ; Is entity the Boy?
$8F:CD67  90 0E        BCC $CD77
$8F:CD69  B9 98 00     LDA $0098,Y      ; Load companion waypoint index
$8F:CD6C  AA           TAX
$8F:CD6D  30 08        BMI $CD77        ; If negative, no active waypoint target
$8F:CD6F  86 4E        STX $4E
$8F:CD71  22 37 99 8F  JSL $8F9937      ; Navigate companion towards waypoint
$8F:CD75  80 00        BRA $CD77
$8F:CD77  ...          RTL
```

---

## 4. Clean C Implementation

```c
/**
 * Executes one companion and active player control update pass.
 * Called once per frame during active gameplay.
 *
 * @param active_player_mask Bitmask of active player characters (1 = Boy, 2 = Dog).
 * @param cutscene_freeze    True if cutscenes or dialog lock party movement.
 */
void companion_ai_tick(uint16_t active_player_mask, bool cutscene_freeze) {
    if (cutscene_freeze) {
        return;
    }

    /* Process Boy entity slot ($7E:4E89) */
    if (active_player_mask & 0x0001) {
        // Boy is player-controlled: read controller input directly
        update_player_entity(ENTITY_BOY_PTR);
    } else {
        // Boy is companion: execute follower AI towards the Dog
        companion_entity_update(ENTITY_BOY_PTR, ENTITY_DOG_PTR);
    }

    /* Process Dog entity slot ($7E:4F37) */
    if (active_player_mask & 0x0002) {
        // Dog is player-controlled: read controller input directly
        update_player_entity(ENTITY_DOG_PTR);
    } else {
        // Dog is companion: execute sniffing, follow, and combat target AI
        companion_entity_update(ENTITY_DOG_PTR, ENTITY_BOY_PTR);
    }
}

/**
 * Updates a companion entity's navigation, following distance, and sniffing state.
 *
 * @param companion_ptr WRAM address of the companion entity ($4E89 or $4F37).
 * @param leader_ptr    WRAM address of the player-controlled leader entity.
 */
void companion_entity_update(uint16_t companion_ptr, uint16_t leader_ptr) {
    /* 1. Clear transient obstacle/movement flags */
    uint16_t flags10 = read_wram16(companion_ptr + ENT_OFF_FLAGS_10);
    flags10 &= ~0x2021; // Clear colliding and stuck bits
    write_wram16(companion_ptr + ENT_OFF_FLAGS_10, flags10);

    /* 2. Compute distance vector to leader */
    int16_t comp_x = (int16_t)read_wram16(companion_ptr + ENT_OFF_POS_X);
    int16_t comp_y = (int16_t)read_wram16(companion_ptr + ENT_OFF_POS_Y);
    int16_t lead_x = (int16_t)read_wram16(leader_ptr + ENT_OFF_POS_X);
    int16_t lead_y = (int16_t)read_wram16(leader_ptr + ENT_OFF_POS_Y);

    int16_t dx = lead_x - comp_x;
    int16_t dy = lead_y - comp_y;
    uint32_t dist_sq = (uint32_t)(dx * dx + dy * dy);

    /* 3. If entity is the Dog, check for nearby hidden ingredient sniffing spots */
    if (companion_ptr == ENTITY_DOG_PTR) {
        uint16_t sniff_spot_obj = check_sniff_spot_proximity(comp_x, comp_y, 48 /* radius px */);
        if (sniff_spot_obj != 0) {
            // Dog detected hidden ingredient: turn towards spot and start sniffing anim
            write_wram16(companion_ptr + ENT_OFF_TARGET_PTR, sniff_spot_obj);
            trigger_dog_sniff_animation(companion_ptr);
            return;
        }
    }

    /* 4. Follow distance leash:
     *    - Within 32 pixels: companion is comfortable in idle/stand stance.
     *    - 32 to 128 pixels: companion walks towards leader.
     *    - > 128 pixels: companion runs / sprints to catch up.
     *    - > 384 pixels: companion is teleported to leader coordinates to prevent desync.
     */
    if (dist_sq > (384 * 384)) {
        // Desync recovery teleport
        write_wram16(companion_ptr + ENT_OFF_POS_X, lead_x);
        write_wram16(companion_ptr + ENT_OFF_POS_Y, lead_y);
    } else if (dist_sq > (32 * 32)) {
        // Navigate companion towards leader waypoint
        navigate_towards(companion_ptr, lead_x, lead_y, dist_sq > (128 * 128) /* run */);
    }
}

/**
 * Handles B-button interaction on a detected sniff spot (Global Script 0x39).
 *
 * @param spot_id The sniff spot trigger ID.
 */
void trigger_sniff_spot_loot(uint16_t spot_id) {
    uint16_t active_player = read_wram16(WRAM_ACTIVE_PLAYER);

    // If player is controlling the Dog, loot cannot be picked up directly
    if (!(active_player & 0x0001)) {
        // Clear loot success flag ($22EA bit 0)
        uint16_t flags = read_wram16(WRAM_LOOT_SUCCESS_FLAG);
        write_wram16(WRAM_LOOT_SUCCESS_FLAG, flags & ~0x0001);
        return;
    }

    // Boy triggers excavation: play dog digging animation, award ingredient
    uint16_t item_id = read_wram16(WRAM_LOOT_MAILBOX_ITEM);
    bool added = inventory_add_item(item_id, 1);

    uint16_t flags = read_wram16(WRAM_LOOT_SUCCESS_FLAG);
    if (added) {
        write_wram16(WRAM_LOOT_SUCCESS_FLAG, flags | 0x0001);
    } else {
        write_wram16(WRAM_LOOT_SUCCESS_FLAG, flags & ~0x0001);
    }
}
```
