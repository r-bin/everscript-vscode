# Dynamic Buff Persistence, Weapon Equip & Stamina Initialization Engine ($8F:9210 – $8F:935E)

## 1. Subsystem Architecture Overview

The equipment and status synchronization pipeline in Bank `$8F` (`$8F:9210` – `$8F:935E`) acts as the central coordinator between gameplay inventory modifications, passive charm persistence, weapon equip transitions, and player charge stamina initialization:

1. **Dynamic Buff Application & Removal Latches (`$8F:9210` – `$8F:9272`)**:
   - **Buff Latch Register `$7E:243D`**:
     - When loaded with a buff index ($\ge 0$), queries byte offset table `tbl_CCBBB0,X` and bitmask table `tbl_CCBBD8,X`.
     - Atomically ORs the bitmask into the targeted persistence byte (`$7E:2261`..`$7E:2263`).
     - Resets latch `$7E:243D = 0xFFFF`.
     - Rebuilds party stats via `character_stat_recalculation_armor` (`$8F:8398`) and companion stats via `$8F:857D`.
   - **Debuff / Removal Latch Register `$7E:243F`**:
     - When loaded with a buff index ($\ge 0$), queries the same tables.
     - Inverts the bitmask (`EOR #$FFFF`) and clears the bit in persistence RAM.
     - Resets latch `$7E:243F = 0xFFFF`.
     - Cascades stat recalculations across Boy and Dog.

2. **Weapon Equipping & Bitfield Synchronization (`$8F:9273` – `$8F:92EE`)**:
   - Inspects weapon equip request register `$7E:2441`:
     - **Un-equip Request ($< 0$)**: Loops over 13 weapon categories, clearing equipped bits in `$7E:22DA` and `$7E:22DB` using ROM tables `tbl_C459A4` and `tbl_C459C0`. Sets transition flags `$7E:23BF = 1` and `$7E:0ABA = 0`.
     - **Equip Weapon Request ($> 0$)**: Configures weapon animation state timers (`$7E:1434`, `$7E:145D`, `$7E:145E`), updates persistence bitmask in `$7E:22DA`/`$7E:22DB`, and assigns active weapon ID to `$7E:0ABA` and `$7E:235F`.
   - Zeroes request register `$7E:2441 = 0`.

3. **Stamina Priming & Sprite Slice Dispatch (`$8F:92EF` – `$8F:935E`)**:
   - If a weapon transition occurred (`$7E:23BF != 0`):
     - Populates weapon base might and parameters into `$7E:0A58`..`$7E:0A6C`:
       - Base attack: `$7E:0A58 = 0x3EFE`
       - Charged attack: `$7E:0A5A = 0x3F0E`
       - Special proc: `$7E:0A5C = 0x3F1E`
     - Primes default full charge stamina `$0400` (`100.0%`) into both Boy `$7E:4EB7` and Dog `$7E:4F65`.
     - Clears charging locks in status registers `$7E:4E9B` and `$7E:4F49` (`TRB #$0800`).
     - Configures weapon graphic descriptor `$7E:0A2F = 0xAD0B` and triggers dynamic sprite slice assembly via `func_D0CF3A` (`$90:CF3A`).

---

## 2. 65816 Disassembly Analysis

```assembly
; ==============================================================================
; equipment_weapon_equip_and_buff_sync ($8F:9210 - $8F:935E)
; ==============================================================================
$8F:9210  AE 3D 24     LDX $243D           ; Active Buff Latch ($7E:243D)
$8F:9213  30 2B        BMI $8F9240         ; If negative, no buff request
$8F:9215  BF B0 BB CC  LDA $CCBBB0,X       ; Target WRAM byte offset table
$8F:9219  A8           TAY
$8F:921A  BF D8 BB CC  LDA $CCBBD8,X       ; Buff bitmask table
$8F:921E  19 00 00     ORA $0000,Y         ; OR into persistence byte ($7E:2261..$7E:2263)
$8F:9221  99 00 00     STA $0000,Y
$8F:9224  A9 FF FF     LDA #$FFFF
$8F:9227  8D 3D 24     STA $243D           ; Clear buff request latch
$8F:922A  22 98 83 8F  JSL $8F8398         ; Recalculate Boy armor and stats
$8F:922E  22 7D 85 8F  JSL $8F857D         ; Recalculate Dog stats and form
$8F:9232  A2 89 4E     LDX #$4E89
$8F:9235  22 44 91 8F  JSL $8F9144         ; Verify Boy active status conditions
$8F:9239  A2 37 4F     LDX #$4F37
$8F:923C  22 44 91 8F  JSL $8F9144         ; Verify Dog active status conditions

; Debuff / Removal Latch:
$8F:9240  AE 3F 24     LDX $243F           ; Remove Buff Latch ($7E:243F)
$8F:9243  30 2E        BMI $8F9273
$8F:9245  BF B0 BB CC  LDA $CCBBB0,X
$8F:9249  A8           TAY
$8F:924A  BF D8 BB CC  LDA $CCBBD8,X
$8F:924E  49 FF FF     EOR #$FFFF          ; Invert bitmask
$8F:9251  39 00 00     AND $0000,Y         ; Clear bit in persistence byte
$8F:9254  99 00 00     STA $0000,Y
$8F:9257  A9 FF FF     LDA #$FFFF
$8F:925A  8D 3F 24     STA $243F
$8F:925D  22 98 83 8F  JSL $8F8398
$8F:9261  22 7D 85 8F  JSL $8F857D
$8F:9265  A2 89 4E     LDX #$4E89
$8F:9268  22 44 91 8F  JSL $8F9144
$8F:926C  A2 37 4F     LDX #$4F37
$8F:926F  22 44 91 8F  JSL $8F9144

; Weapon Equip Processor:
$8F:9273  AE 41 24     LDX $2441           ; Weapon Equip Request ($7E:2441)
$8F:9276  F0 77        BEQ $8F92EF         ; No request
$8F:9278  10 38        BPL $8F92B2         ; If > 0, equip weapon!

; Un-equip weapon:
$8F:927A  A2 00 00     LDX #$0000
$8F:927D  E8 E8        INX : INX
$8F:927F  BF A4 59 C4  LDA $C459A4,X       ; Weapon equipped bitfield table
$8F:9283  A8           TAY
$8F:9284  B9 00 00     LDA $0000,Y
$8F:9287  1F C0 59 C4  ORA $C459C0,X
$8F:928B  5F C0 59 C4  EOR $C459C0,X       ; Clear weapon bit
$8F:928F  99 00 00     STA $0000,Y
$8F:9292  E0 1A 00     CPX #$001A
$8F:9295  90 E6        BCC $8F927D
$8F:9297  E2 20        SEP #$20
$8F:9299  9C 5F 23     STZ $235F
$8F:929C  9C 60 23     STZ $2360
$8F:929F  A9 01        LDA #$01
$8F:92A1  8D BF 23     STA $23BF           ; Set weapon transition flag
$8F:92A4  C2 20        REP #$20
$8F:92A6  9C 41 24     STZ $2441           ; Clear request
$8F:92A9  9C BA 0A     STZ $0ABA           ; Active weapon ID = 0
$8F:92AC  22 98 83 8F  JSL $8F8398
$8F:92B0  80 3D        BRA $8F92EF

; Equip weapon:
$8F:92B2  A9 FF FF     LDA #$FFFF
$8F:92B5  8D 34 14     STA $1434
$8F:92B8  A9 65 01     LDA #$0165
$8F:92BB  8D 5D 14     STA $145D
$8F:92BE  A9 01 CA     LDA #$CA01
$8F:92C1  8D 5E 14     STA $145E
$8F:92C4  BF DC 59 C4  LDA $C459DC,X
$8F:92C8  E2 20        SEP #$20
$8F:92CA  8D 60 23     STA $2360
$8F:92CD  C2 20        REP #$20
$8F:92CF  BF A4 59 C4  LDA $C459A4,X
$8F:92D3  A8           TAY
$8F:92D4  BF C0 59 C4  LDA $C459C0,X
$8F:92D8  19 00 00     ORA $0000,Y         ; Set weapon bit in persistence WRAM
$8F:92DB  99 00 00     STA $0000,Y
$8F:92DE  8E BA 0A     STX $0ABA           ; Active weapon ID ($7E:0ABA)
$8F:92E1  E2 10        SEP #$10
$8F:92E3  8E 5F 23     STX $235F
$8F:92E6  C2 10        REP #$10
$8F:92E8  9C 41 24     STZ $2441
$8F:92EB  22 98 83 8F  JSL $8F8398

; Stamina Priming & Parameter Assignment:
$8F:92EF  AD BF 23     LDA $23BF           ; Did weapon transition occur?
$8F:92F2  F0 6A        BEQ $8F935E
$8F:92F4  7B           TDC
$8F:92F5  CD 34 14     CMP $1434
$8F:92F8  F0 63        BEQ $8F935D
$8F:92FA  8D 34 14     STA $1434
$8F:92FD  A9 FE 3E     LDA #$3EFE
$8F:9300  8D 58 0A     STA $0A58           ; Base weapon might
$8F:9303  A9 0E 3F     LDA #$3F0E
$8F:9306  8D 5A 0A     STA $0A5A
$8F:9309  A9 1E 3F     LDA #$3F1E
$8F:930C  8D 5C 0A     STA $0A5C
$8F:930F  A9 2E 3F     LDA #$3F2E
$8F:9312  8D 66 0A     STA $0A66
$8F:9315  A9 4E 41     LDA #$414E
$8F:9318  8D 6C 0A     STA $0A6C

; Prime 100.0% Stamina ($0400):
$8F:9322  A9 00 04     LDA #$0400          ; 1024 = 100.0% charge
$8F:9325  8D B7 4E     STA $4EB7           ; Boy charge stamina ($7E:4EB7)
$8F:9328  8D 65 4F     STA $4F65           ; Dog charge stamina ($7E:4F65)

; Clear Charging Locks:
$8F:932B  A9 00 08     LDA #$0800
$8F:932E  1C 9B 4E     TRB $4E9B           ; Clear lock bit 11 in Boy
$8F:9331  1C 49 4F     TRB $4F49           ; Clear lock bit 11 in Dog

; Trigger Weapon Sprite Assembly:
$8F:934D  A9 0B AD     LDA #$AD0B          ; Weapon slice descriptor offset
$8F:9350  8D 2F 0A     STA $0A2F
$8F:9353  A2 0C 00     LDX #$000C
$8F:9356  9D 78 12     STA $1278,X
$8F:9359  22 3A CF 90  JSL $90CF3A         ; Assemble sprite slices via sprite_slice_descriptor_composite
$8F:935D  6B           RTL
$8F:935E  6B           RTL
```

---

## 3. Clean C Reconstructed Implementation

```c
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
```

---

## 4. Architectural Invariants & Memory Anchors

- **Atomic Latch Inter-Process Communication**:
  - Script opcodes and ring menu actions trigger buff alterations and weapon swaps simply by writing indices into latches `$7E:243D`, `$7E:243F`, and `$7E:2441`.
  - The routine processes requests on the subsequent frame tick, resetting latches to `-1` or `0` to signal completion.
- **Weapon Charge Initialization**:
  - Whenever a new weapon is drawn or swapped, the stamina meter instantly resets to full charge (`1024 = 0x0400 = 100.0%`), preventing the player from being penalized with 0% charge upon equipping a new weapon during combat.
- **Persistence Table Mapping**:
  - Tables `tbl_C459A4` and `tbl_C459C0` bridge weapon IDs to persistent SRAM save bitfields in `$7E:22DA` and `$7E:22DB`, ensuring equipment state survives game saving and reloads.
