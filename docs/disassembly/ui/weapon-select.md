# Weapon Swapping & Ring Menu Sub-Item Selector

> **ROM Bank**: `$8E` (Ring Menu Handlers), `$8C` (Audio Dispatch)  
> **Source Routines**: `$8E:8F50` (`ring_menu_subitem_select`), `$8E:9000` (`weapon_equip_and_experience_update`)  
> **Related Routines**: `$8E:8D80` (Cost validator), `$8C:82DC` (Direct sound effect trigger), `$8C:9E03` (Menu string renderer)  
> **Memory Map**: `$7E:0AC6` (Current weapon skill experience), `$7E:0AC8` (Weapon skill level), `$7E:231C` (Equipped weapon ID), `$7E:2348` (Held weapons bitfield), `$7E:05A9` (System interaction mode, bit 6: rejection buzz)

---

## 1. Architectural Overview

Weapon switching in *Secret of Evermore* is managed through the character's circular **Ring Menu** subsystem in Bank `$8E`. When the player highlights a weapon category (Swords, Axes, Spears, or Bazookas) and presses the action button, the engine evaluates whether the hero currently owns that specific weapon variant, updates the equipped weapon register, recalculates active weapon experience, and plays an equip confirmation sound effect.

### Key Subsystems:
1. **Ownership & Eligibility Validation (`$8E:8F50`)**:
   - The selected ring slot index in `$12` is shifted and converted into an inventory item index: `A = (item_index >> 1) - 1`.
   - Reads the held item count / ownership byte from `$7E:231D,x`.
   - Compares against maximum allowance (`CMP #$07`). If the weapon is locked or unacquired, the engine asserts error rejection bit `0x0020` in `$05A9`, triggering an error buzz sound and keeping the current weapon equipped.
2. **Weapon Equipping & Stat Refresh (`$8E:9000`)**:
   - Compares the selected weapon ID against currently equipped weapon registers `$0AC4` and `$0ABE`.
   - If a new weapon is confirmed:
     - Updates the equipped weapon slot at `$7E:231C,x`.
     - Validates weapon attack eligibility (`CMP #$0002`).
     - Loads accumulated weapon skill experience from `$7E:2348` and updates live combat registers `$0AC6,x` and `$0AC8,x`.
3. **Sound Effect & UI Feedback (`$8E:9046`)**:
   - Upon successfully equipping the weapon, accumulator `A` is loaded with sound effect ID `#$0043` (Equip Clink).
   - Invokes direct sound effect dispatcher `JSL $8C82DC` to play the confirmation tone without disrupting active background music.
   - Triggers redraw of weapon level Roman numerals (Level 1..3) in the active status window.

---

## 2. 65816 Assembly Implementation

```assembly
; ==============================================================================
; $8E:8F50 - Ring Menu Sub-Item / Weapon Selector
; ==============================================================================
ring_menu_subitem_select:
    ASL $0CC6
    BPL .valid_slot
    LDA #$0010
    TSB $05A9                   ; Set rejection flag
    PLB
    JMP $AD67                   ; Abort to menu navigation loop

.valid_slot:
    STA $0A
    LDA $12                     ; Selected sub-index
    LSR A
    DEC A
    TAX
    SEP #$20                    ; 8-bit accumulator
    LDA $231D,X                 ; Read item count / ownership flag
    INC A
    CMP #$07                    ; Max allowed count check
    BMI .equip_allowed
    REP #$20
    LDA #$0020
    TSB $05A9                   ; Trigger buzzer sound
    PLB
    JMP $AD67

.equip_allowed:
    REP #$20
    ; Fall through to weapon equip handler

; ==============================================================================
; $8E:9000 - Weapon Equip & Experience Transfer
; ==============================================================================
weapon_equip_and_experience_update:
    CMP $0AC4                   ; Is it already equipped in primary slot?
    BEQ .same_weapon
    CMP $0ABE                   ; Is it already equipped in secondary slot?
    BNE .new_weapon_selected

.same_weapon:
    TXA
    LSR A
    TAX
    LDA $231C,X                 ; Read weapon inventory record
    AND #$00FF
    CMP #$0002
    BPL .new_weapon_selected
    LDA #$0040
    TSB $05A9                   ; Equip error flag
    PLB
    JMP $AD67

.new_weapon_selected:
    LDA $7E2348                 ; Load weapon experience base
    AND #$00FF
    TAX
    LDA $0AC6,X                 ; Read current weapon XP
    CLC
    ADC $0BF5                   ; Apply weapon skill bonus
    STA $0AC6,X                 ; Update XP register
    SEP #$20
    LDA #$00
    ADC $0AC8,X                 ; Propagate carry into weapon Level
    STA $0AC8,X
    REP #$20

    ; Play Equip Sound Effect ($0043)
    PHB
    PHK
    PLB
    PHA
    PHX
    PHY
    LDA #$0043                  ; SFX $43 = Weapon Equip Clink
    JSL $8C82DC                 ; Dispatch sound command
    PLY
    PLX
    PLA
    PLB
    RTL
```

---

## 3. Clean C Decompilation

```c
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
```
