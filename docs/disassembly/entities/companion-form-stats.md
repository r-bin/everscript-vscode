# Companion (Dog) Level Stat Scaling, Collar Armor & Toaster Form Transformation ($8F:857D – $8F:8688)

## 1. Subsystem Architecture Overview

The companion (Dog) progression and combat parameter engine in Bank `$8F` (`$8F:857D` – `$8F:8688`) recalculates all companion offensive, defensive, and vitality statistics whenever the companion levels up, equips new collars, acquires passive alchemy charms, or transforms across historical epochs:

1. **Level-Based Stat Curve Indexing (`$8F:857D` – `$8F:8640`)**:
   - Reads companion level from `$7E:0A9A` ($0 \dots 98$), shifts left by 1 to index word tables in Bank `$8C`:
     - **Max HP (`$7E:0A7F`)**: Queries base table `$8C:9515,X`. If Chocobo Egg charm (`$7E:2261 & 0x0040`) is held, queries amplified table `$8C:951F,X`. Clamps Max HP to 999 (`0x03E7`) and updates current HP clamp `$7E:4F61`.
     - **Magic Defense (`$7E:0A89`)**: Queries table `$8C:96D1,X` (amplified by charm `$7E:2263 & 0x0001`), and adds accessory gear bonus `$7E:4FD7`.
     - **Physical Defense (`$7E:0A8B`)**: Queries table `$8C:95F3,X` (amplified by Armor Polish charm `$7E:2262 & 0x0080`), and adds accessory gear bonus `$7E:4FD9`.
     - **Evade (`$7E:0A8D`)**: Queries table `$8C:97AF,X` (amplified by charm `$7E:2263 & 0x0004`), and adds accessory gear bonus `$7E:4FDF`.
     - **Hit Rate (`$7E:0A91`)**: Queries table `$8C:90BF,X` (amplified by charm `$7E:2262 & 0x0001`) + gear `$7E:4FDD`, clamped to 99 max (`0x0063`).
     - **Attack Power (`$7E:0A8F`)**: Queries table `$8C:8FE1,X` (amplified by Atlas charm `$7E:2263 & 0x0002`) + gear `$7E:4FDB`, clamped to 99 max (`0x0063`).

2. **Equipped Collar Defense Addition (`$8F:8640` – `$8F:8664`)**:
   - Reads equipped collar item ID from `$7E:0ABE`.
   - If a collar is equipped ($> 0$), queries ROM armor defense table at `$C4:0000 + (collar_id * 2)`.
   - Checks charm modifier `$7E:2261 & 0x0020`; if active, applies $+25\%$ bonus ($D + \lfloor D / 4 \rfloor$).
   - Sums collar defense into the companion's effective defense `$7E:0A8B`.

3. **Toaster Dog Epoch Form Transformation (`$8F:8664` – `$8F:8688`)**:
   - Checks active companion form register `$7E:2363`.
   - Form `0x000C` corresponds to the secret **Toaster Dog form** in Omnitopia:
     - Directly adds $+80$ Magic Defense (`+$0050` into `$7E:0A89`).
     - Directly adds $+250$ Physical Defense (`+$00FA` into `$7E:0A8B`).
   - Restores Data Bank and returns.

---

## 2. 65816 Disassembly Analysis

```assembly
; ==============================================================================
; companion_stats_scaling_and_form_rebuild ($8F:857D - $8F:8688)
; ==============================================================================
$8F:857D  8B           PHB
$8F:857E  F4 7E 7E     PEA $7E7E
$8F:8581  AB           PLB
$8F:8582  AB           PLB                 ; Set Data Bank = $7E

; Index Dog Level:
$8F:8583  AD 9A 0A     LDA $0A9A           ; Dog Level ($7E:0A9A)
$8F:8586  0A           ASL A               ; Word index
$8F:8587  AA           TAX

; 1. Max HP Calculation:
$8F:8588  AF 61 22 7E  LDA $7E2261         ; Permanent Charms Bitfield 1
$8F:858C  89 40 00     BIT #$0040          ; Bit 6: Chocobo Egg Charm?
$8F:858F  F0 06        BEQ $8F8597
$8F:8591  BF 1F 95 8C  LDA $8C951F,X       ; Boosted HP curve from Bank $8C
$8F:8595  80 04        BRA $8F859B
$8F:8597  BF 15 95 8C  LDA $8C9515,X       ; Base Dog HP curve
$8F:859B  C9 E7 03     CMP #$03E7          ; Clamp to 999 Max HP
$8F:859E  30 03        BMI $8F85A3
$8F:85A0  A9 E7 03     LDA #$03E7
$8F:85A3  8D 7F 0A     STA $0A7F           ; Dog Max HP ($7E:0A7F)
$8F:85A6  CD 61 4F     CMP $4F61           ; Current HP ($7E:4F61)
$8F:85A9  10 03        BPL $8F85AE
$8F:85AB  8D 61 4F     STA $4F61           ; Clamp current HP if exceeding new Max

; 2. Magic Defense Calculation:
$8F:85AE  AF 63 22 7E  LDA $7E2263         ; Charms Bitfield 3
$8F:85B2  89 01 00     BIT #$0001          ; Magic Charm?
$8F:85B5  F0 06        BEQ $8F85BD
$8F:85B7  BF DB 96 8C  LDA $8C96DB,X       ; Boosted M.Def curve
$8F:85BB  80 04        BRA $8F85C1
$8F:85BD  BF D1 96 8C  LDA $8C96D1,X       ; Base M.Def curve
$8F:85C1  18           CLC
$8F:85C2  6D D7 4F     ADC $4FD7           ; Add gear bonus
$8F:85C5  8D 89 0A     STA $0A89           ; Dog Magic Defense ($7E:0A89)

; 3. Physical Defense Calculation:
$8F:85C8  AF 62 22 7E  LDA $7E2262         ; Charms Bitfield 2
$8F:85CC  89 80 00     BIT #$0080          ; Armor Polish Charm?
$8F:85CF  F0 06        BEQ $8F85D7
$8F:85D1  BF FD 95 8C  LDA $8C95FD,X       ; Boosted P.Def curve
$8F:85D5  80 04        BRA $8F85DB
$8F:85D7  BF F3 95 8C  LDA $8C95F3,X       ; Base P.Def curve
$8F:85DB  18           CLC
$8F:85DC  6D D9 4F     ADC $4FD9           ; Add gear bonus
$8F:85DF  8D 8B 0A     STA $0A8B           ; Dog Physical Defense ($7E:0A8B)

; 4. Evade Calculation:
$8F:85E2  AF 63 22 7E  LDA $7E2263
$8F:85E6  89 04 00     BIT #$0004          ; Evade Charm?
$8F:85E9  F0 06        BEQ $8F85F1
$8F:85EB  BF B9 97 8C  LDA $8C97B9,X
$8F:85EF  80 04        BRA $8F85F5
$8F:85F1  BF AF 97 8C  LDA $8C97AF,X
$8F:85F5  18           CLC
$8F:85F6  6D DF 4F     ADC $4FDF
$8F:85F9  8D 8D 0A     STA $0A8D           ; Dog Evade ($7E:0A8D)

; 5. Hit Rate Calculation:
$8F:85FC  AF 62 22 7E  LDA $7E2262
$8F:8600  89 01 00     BIT #$0001          ; Accuracy Charm?
$8F:8603  F0 06        BEQ $8F860B
$8F:8605  BF C9 90 8C  LDA $8C90C9,X
$8F:8609  80 04        BRA $8F860F
$8F:860B  BF BF 90 8C  LDA $8C90BF,X
$8F:860F  18           CLC
$8F:8610  6D DD 4F     ADC $4FDD
$8F:8613  C9 63 00     CMP #$0063          ; Clamp to 99 max
$8F:8616  30 03        BMI $8F861B
$8F:8618  A9 63 00     LDA #$0063
$8F:861B  8D 91 0A     STA $0A91           ; Dog Hit Rate ($7E:0A91)

; 6. Attack Power Calculation:
$8F:861E  AF 63 22 7E  LDA $7E2263
$8F:8622  89 02 00     BIT #$0002          ; Atlas Charm?
$8F:8625  F0 06        BEQ $8F862D
$8F:8627  BF EB 8F 8C  LDA $8C8FEB,X
$8F:862B  80 04        BRA $8F8631
$8F:862D  BF E1 8F 8C  LDA $8C8FE1,X
$8F:8631  18           CLC
$8F:8632  6D DB 4F     ADC $4FDB
$8F:8635  C9 63 00     CMP #$0063          ; Clamp to 99 max
$8F:8638  30 03        BMI $8F863D
$8F:863A  A9 63 00     LDA #$0063
$8F:863D  8D 8F 0A     STA $0A8F           ; Dog Attack Power ($7E:0A8F)

; 7. Collar Armor Addition:
$8F:8640  A9 00 00     LDA #$0000
$8F:8643  AE BE 0A     LDX $0ABE           ; Equipped Collar Item ID ($7E:0ABE)
$8F:8646  F0 1C        BEQ $8F8664         ; No collar equipped
$8F:8648  18           CLC
$8F:8649  7F 00 00 C4  ADC $C40000,X       ; Read armor defense value from Bank $C4
$8F:864D  85 12        STA $12             ; DP $12 = base armor defense
$8F:864F  AD 61 22     LDA $2261
$8F:8652  89 20 00     BIT #$0020          ; Charmed defense multiplier?
$8F:8655  F0 0B        BEQ $8F8662
$8F:8657  A5 12        LDA $12
$8F:8659  4A 4A 4A 4A  LSR : LSR : LSR : LSR ; Defense >> 4 (+25%)
$8F:865D  18           CLC
$8F:865E  65 12        ADC $12
$8F:8660  80 02        BRA $8F8664
$8F:8662  A5 12        LDA $12
$8F:8664  18           CLC
$8F:8665  6D 8B 0A     ADC $0A8B           ; Add to companion defense
$8F:8668  8D 8B 0A     STA $0A8B

; 8. Toaster Dog Transformation Check:
$8F:866B  AE 63 23     LDX $2363           ; Dog Transformation Form ($7E:2363)
$8F:866E  E0 0C 00     CPX #$000C          ; Form 0x000C = Toaster Dog!
$8F:8671  D0 14        BNE $8F8687         ; Standard form
$8F:8673  A9 50 00     LDA #$0050          ; +80 Magic Defense
$8F:8676  18           CLC
$8F:8677  6D 89 0A     ADC $0A89
$8F:867A  8D 89 0A     STA $0A89
$8F:867D  A9 FA 00     LDA #$00FA          ; +250 Physical Defense
$8F:8680  18           CLC
$8F:8681  6D 8B 0A     ADC $0A8B
$8F:8684  8D 8B 0A     STA $0A8B

$8F:8687  AB           PLB
$8F:8688  6B           RTL
```

---

## 3. Clean C Reconstructed Implementation

```c
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
```

---

## 4. Architectural Invariants & Memory Anchors

- **Toaster Dog Form `0x000C`**:
  - In Omnitopia, entering the secret toaster transformation alters the Dog's appearance to a mechanical toaster and grants a colossal $+80$ Magic Defense and $+250$ Physical Defense, making the companion almost impervious to standard enemy attacks.
- **Charm Integration Matrix**:
  - Permanent charms in `$7E:2261`..`$7E:2263` do not apply flat additions; they swap the entire underlying scaling curve to a higher-growth polynomial curve in Bank `$8C`, ensuring proportional scaling as level increases.
- **Max HP Clamping**:
  - The routine strictly enforces the 999 HP engine limit (`$7E:0A7F`) and clamps active current HP (`$7E:4F61`) if an equipment swap or charm removal drops max HP below current HP.
