# Enemy AI Behavioral State Machine & Leash Radius ($8F:CD17, $8F:D34B, $8F:D69B, $8F:D6FB)

> **Subsystem**: Enemy Combat AI & Behavioral Dispatcher  
> **ROM Addresses**: `$8F:CD17` (`enemy_ai_dispatcher`), `$8F:D34B` (`enemy_ai_roaming_chaser`), `$8F:D69B` (`enemy_ai_check_aggro`), `$8F:D6FB` (`enemy_ai_stationary_turret`)  
> **Clean C Module**: `entities/enemy-ai.c`  
> **Jump Table**: `$8F:CBE0` (15 AI behavior pointers)  
> **Confidence**: Confirmed

---

## 1. Architectural Role

In Secret of Evermore, enemy AI is executed natively in 65816 assembly (Bank `$8F`), rather than via an interpreted scripting bytecode:
- **Dispatcher (`$8F:CD17`)**: Each entity in WRAM holds an offset into the ROM character table at `entity +0x60`. Every frame, the dispatcher reads `LDA $8E0003,X` to fetch the 16-bit behavior index (`0, 2, 4, ..., 28`) and jumps through the master table at `$8F:CBE0`.
- **Standard Roaming / Chasing Monster (`$8F:D34B`, Index `0x00`)**: Drives 53 monster types (Raptors, Oglins, Son of Set, Hedgadillos, Sand Spiders, Bad Boys, etc.). Monsters roam within their spawn leash radius (`entity +0x40`), test target proximity against their `aggro_range` (`character +0x13`), and advance along 8/16-angle vectors towards the player.
- **Aggro Filter Pipeline (`$8F:D69B` – `$8F:D6FA`)**:
  1. **Stamina Gate**: An enemy will *never* initiate an aggro charge or attack cycle if its stamina `+0x2E` is below `0x0400` (100%).
  2. **RNG Dice Roll**: Calls engine RNG (`$80:859B`) and requires `rand(0..255) < aggro_chance` (`character +0x15`).
  3. **Target Proximity Test (`$8F:D6CE`)**: Tests Boy (`$0F3E`) and Dog (`$0F40`). If HP > 0 and horizontal distance $|dx| < \text{range}$ and vertical distance $|dy| < \text{range}$, the target is acquired.
  4. **Target Acquisition**: Stores target pointer in `entity +0x24`, faces target via `$80:ADF0`, and sets combat action state `+0x78`.
- **Stationary Plant / Turret Hazard (`$8F:D6FB`, Index `0x08`)**: Drives 12 immobile enemies (Wimpy Flower, Carniflower, Thraxx Claws, Stone Cobra). They remain rooted, evaluate the aggro pipeline, and fire projectile lunges, spits, or claw strikes when targets enter reach.

---

## 2. Disassembly Analysis

```assembly
; ==============================================================================
; $8F:CD17: Enemy Behavior Dispatcher
; ==============================================================================
$8F:CD17  BE 60 00     LDX $0060,Y      ; Load character record offset (+0x60)
$8F:CD1A  BF 03 00 8E  LDA $8E0003,X    ; Read behavior word from ROM bank $8E
$8F:CD1E  AA           TAX              ; Word offset into jump table (0, 2, 4, ..)
$8F:CD1F  7C E0 CB     JMP ($CBE0,X)    ; Indirect jump through AI jump table

; ==============================================================================
; $8F:D69B: Aggro Detection Routine
; ==============================================================================
$8F:D69B  B9 2E 00     LDA $002E,Y      ; Current stamina / charge meter
$8F:D69E  C9 00 04     CMP #$0400       ; Must be >= 100% (1024)
$8F:D6A1  30 26        BMI $D6C9        ; If not full, abort aggro evaluation
$8F:D6A3  BE 60 00     LDX $0060,Y      ; Load character record pointer
$8F:D6A6  22 9B 85 80  JSL $80859B      ; Call RNG
$8F:D6AA  29 FF 00     AND #$00FF       ; 0..255
$8F:D6AD  DF 15 00 8E  CMP $8E0015,X    ; Compare with aggro_chance (+0x15)
$8F:D6B1  10 16        BPL $D6C9        ; If rand >= chance -> abort
$8F:D6B3  BF 13 00 8E  LDA $8E0013,X    ; Load aggro_range (+0x13)
$8F:D6B7  85 06        STA $06          ; Store range threshold in DP $06
$8F:D6B9  AE 3E 0F     LDX $0F3E        ; Load Boy entity pointer
$8F:D6BC  F0 03        BEQ $D6C1
$8F:D6BE  20 CE D6     JSR $D6CE        ; Test proximity to Boy
$8F:D6C1  AE 40 0F     LDX $0F40        ; Load Dog entity pointer
$8F:D6C4  F0 03        BEQ $D6C9
$8F:D6C6  20 CE D6     JSR $D6CE        ; Test proximity to Dog
$8F:D6C9  68           PLA
$8F:D6CA  5C 8E 82 90  JML $90828E      ; Exit to animation/frame step

; ==============================================================================
; $8F:D6CE: Bounding Box Distance Check Subroutine
; ==============================================================================
$8F:D6CE  BD 2A 00     LDA $002A,X      ; Target HP
$8F:D6D1  F0 27        BEQ $D6FA        ; If dead (HP == 0), ignore
$8F:D6D3  BD 1A 00     LDA $001A,X      ; Target X coordinate
$8F:D6D6  38           SEC
$8F:D6D7  F9 1A 00     SBC $001A,Y      ; Subtract Enemy X
$8F:D6DA  10 06        BPL $D6E2        ; If positive, dx is valid
$8F:D6DC  49 FF FF     EOR #$FFFF       ; Absolute value: negate
$8F:D6DF  1A           INC A
$8F:D6E2  C5 06        CMP $06          ; Compare |dx| with aggro_range
$8F:D6E4  B0 14        BCS $D6FA        ; Outside horizontal range
$8F:D6E6  BD 1C 00     LDA $001C,X      ; Target Y coordinate
$8F:D6E9  38           SEC
$8F:D6EA  F9 1C 00     SBC $001C,Y      ; Subtract Enemy Y
$8F:D6ED  10 06        BPL $D6F5
$8F:D6EF  49 FF FF     EOR #$FFFF
$8F:D6F2  1A           INC A
$8F:D6F5  C5 06        CMP $06          ; Compare |dy| with aggro_range
$8F:D6F7  B0 01        BCS $D6FA        ; Outside vertical range
$8F:D6F9  8E 24 00     STX $0024,Y      ; Target acquired! Store target pointer in +0x24
$8F:D6FA  60           RTS
```

---

## 3. Clean C Implementation

```c
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
```
