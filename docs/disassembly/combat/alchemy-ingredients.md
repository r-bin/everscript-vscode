# Alchemy Formula Inventory & Ingredient Consumption Math ($91:D800, $C4:601F, $7E:22FF)

> **Subsystem**: Alchemy Formula Engine & Inventory Consumption  
> **ROM Addresses**: `$91:D800` (`alchemy_deduct_ingredients_and_award_xp`), `$C4:601F` (`ALCHEMY_COST_DATA`), `$C4:5B9C` (`XP_GAIN_PER_CAST`), `$C4:5BA5` (`LEVEL_MULTIPLIERS`)  
> **Clean C Module**: `combat/alchemy-ingredients.c`  
> **Confidence**: Confirmed

---

## 1. Architectural Role

Secret of Evermore implements an alchemy system consisting of 35 distinct formulas. Unlike typical MP-based magic systems, spells require specific alchemical reagents from an inventory of 22 ingredient types:
- **Ingredient Inventory (`$7E:22FF` – `$7E:2314`)**:
  - 22 contiguous bytes in WRAM: Wax (`$22FF`), Water (`$2300`), Vinegar (`$2301`), Roots (`$2302`), Oil (`$2303`), Mushroom (`$2304`), Mud Pepper (`$2305`), Meteorite (`$2306`), Mineral (`$2307`), Limestone (`$2308`), Iron (`$2309`), Gunpowder (`$230A`), Grease (`$230B`), Feather (`$230C`), Dry Ice (`$230D`), Crystal (`$230E`), Clay (`$230F`), Brimstone (`$2310`), Bone (`$2311`), Atlas Medallion (`$2312`), Ash (`$2313`), Acorns (`$2314`).
  - Standard items cap at 99. Mud Pepper caps at 1.
- **Cost Table (`$C4:601F`)**:
  - 35 entries $\times$ 4 bytes: `[Ingredient1_ID, Ingredient2_ID, Qty1, Qty2]`.
- **Pre-Cast Validation & Deduction (`$91:D800`)**:
  - Checks whether the player owns $\ge Qty_1$ of $Ing_1$ and $\ge Qty_2$ of $Ing_2$.
  - Deducts quantities immediately upon spell trigger.
  - Increments formula usage stat counter at `$7E:2FDE + X`.
  - Awards formula experience (`$7E:2F52 + X`) based on the spell's current level using table `$C4:5B9C` (`[10, 5, 4, 3, 2, 2, 1, 1, 1, 1]` for Lv0..Lv9).
  - Levels up formula when experience reaches 100 XP (max Level 9:99).

---

## 2. Disassembly Analysis

```assembly
; ==============================================================================
; $91:D800: Deduct Alchemy Ingredients & Award Spell XP
; ==============================================================================
$91:D800  8B           PHB
$91:D801  F4 7E 7E     PEA $7E7E
$91:D804  AB           PLB
$91:D805  AB           PLB              ; Set Data Bank = $7E
$91:D806  0A           ASL A            ; Formula index * 4
$91:D807  0A           ASL A
$91:D808  AA           TAX              ; Index into $C4:601F
$91:D809  BF 1F 60 C4  LDA $C4601F,X    ; Load Ing1_ID (low) and Ing2_ID (high)
$91:D80D  85 00        STA $00
$91:D80F  BF 21 60 C4  LDA $C46021,X    ; Load Qty1 (low) and Qty2 (high)
$91:D813  85 02        STA $02

; Check Ingredient 1
$91:D815  A5 00        LDA $00          ; Ing1 ID
$91:D817  29 FF 00     AND #$00FF
$91:D81A  AA           TAX
$91:D81B  BD FF 22     LDA $22FF,X      ; Load inventory count
$91:D81E  29 FF 00     AND #$00FF
$91:D821  C5 02        CMP $02          ; Compare with Qty1
$91:D823  90 2A        BCC $D84F        ; Insufficient quantity -> abort cast

; Check Ingredient 2 (if present)
$91:D825  A5 00        LDA $00
$91:D827  EB           XBA              ; Ing2 ID
$91:D828  29 FF 00     AND #$00FF
$91:D82B  F0 10        BEQ $D83D        ; No second ingredient
$91:D82D  AA           TAX
$91:D82E  BD FF 22     LDA $22FF,X
$91:D831  29 FF 00     AND #$00FF
$91:D834  A4 03        LDY $03          ; Qty2
$91:D836  C4 03        CPY $03
$91:D838  90 15        BCC $D84F        ; Insufficient -> abort cast

; Deduct Ingredients
$91:D83A  A5 00        LDA $00
$91:D83C  ...          SBC $02          ; Subtract Qty1
$91:D840  9D FF 22     STA $22FF,X

; Award Formula Experience
$91:D850  BD 52 2F     LDA $2F52,X      ; Load current XP ($7E:2F52)
$91:D853  18           CLC
$91:D854  BF 9C 5B C4  ADC $C45B9C,Y    ; Add XP gain for current level
$91:D858  C9 64 00     CMP #$0064       ; Reached 100 XP?
$91:D85B  90 08        BCC $D865
$91:D85D  38           SEC
$91:D85E  E9 64 00     SBC #$0064       ; XP -= 100
$91:D861  FE D6 2E     INC $2ED6,X      ; Level up formula!
$91:D865  9D 52 2F     STA $2F52,X      ; Store updated XP
$91:D868  AB           PLB
$91:D869  6B           RTL
```

---

## 3. Clean C Implementation

```c
#include <stdint.h>
#include <stdbool.h>

#define NUM_ALCHEMY_FORMULAS        35
#define NUM_INGREDIENTS             22

#define INVENTORY_INGREDIENT_BASE   0x22FF
#define FORMULA_XP_BASE             0x2F52
#define FORMULA_LEVEL_BASE          0x2ED6
#define FORMULA_USAGE_BASE          0x2FDE

#define TABLE_ALCHEMY_COST          0xC4601F
#define TABLE_XP_PER_CAST           0xC45B9C
#define TABLE_LEVEL_MULTIPLIERS     0xC45BA5

/* 10 XP per cast at Lv0 tapering to 1 XP at Lv6..Lv9 */
static const uint8_t s_xp_per_cast[10] = { 10, 5, 4, 3, 2, 2, 1, 1, 1, 1 };

/* Damage/Effect level scaling multipliers */
static const uint8_t s_level_multipliers[10] = { 2, 4, 7, 11, 15, 20, 26, 32, 39, 46 };

typedef struct {
    uint8_t ing1_id;
    uint8_t ing2_id;
    uint8_t qty1;
    uint8_t qty2;
} AlchemyFormulaCost;

/**
 * Validates inventory and deducts alchemical ingredients for spell cast ($91:D800).
 *
 * @param formula_index Index of the formula (0..34).
 * @return True if cost requirements were met and ingredients were deducted.
 */
bool alchemy_validate_and_deduct_cost(uint8_t formula_index) {
    if (formula_index >= NUM_ALCHEMY_FORMULAS) {
        return false;
    }

    uint32_t cost_addr = TABLE_ALCHEMY_COST + (formula_index * 4);
    AlchemyFormulaCost cost = {
        .ing1_id = read_rom8(cost_addr + 0),
        .ing2_id = read_rom8(cost_addr + 1),
        .qty1    = read_rom8(cost_addr + 2),
        .qty2    = read_rom8(cost_addr + 3),
    };

    /* 1. Check Ingredient 1 */
    uint16_t ing1_addr = INVENTORY_INGREDIENT_BASE + cost.ing1_id;
    uint8_t owned1 = read_wram8(ing1_addr);
    if (owned1 < cost.qty1) {
        return false; // Insufficient Ingredient 1
    }

    /* 2. Check Ingredient 2 (if required) */
    uint16_t ing2_addr = 0;
    uint8_t owned2 = 0;
    if (cost.qty2 > 0) {
        ing2_addr = INVENTORY_INGREDIENT_BASE + cost.ing2_id;
        owned2 = read_wram8(ing2_addr);
        if (owned2 < cost.qty2) {
            return false; // Insufficient Ingredient 2
        }
    }

    /* 3. Deduct ingredients from WRAM */
    write_wram8(ing1_addr, owned1 - cost.qty1);
    if (cost.qty2 > 0) {
        write_wram8(ing2_addr, owned2 - cost.qty2);
    }

    /* 4. Increment usage counter ($7E:2FDE + X) */
    uint16_t usage = read_wram16(FORMULA_USAGE_BASE + (formula_index * 2));
    write_wram16(FORMULA_USAGE_BASE + (formula_index * 2), usage + 1);

    return true;
}

/**
 * Awards formula experience and manages level progression ($91:D850).
 *
 * @param formula_index Index of the formula (0..34).
 */
void alchemy_award_cast_experience(uint8_t formula_index) {
    if (formula_index >= NUM_ALCHEMY_FORMULAS) {
        return;
    }

    uint16_t lvl_addr = FORMULA_LEVEL_BASE + (formula_index * 2);
    uint16_t xp_addr  = FORMULA_XP_BASE + (formula_index * 2);

    uint16_t current_level = read_wram16(lvl_addr);
    uint16_t current_xp    = read_wram16(xp_addr);

    if (current_level >= 9 && current_xp >= 99) {
        return; // Max Level 9:99 capped
    }

    // Determine XP gain based on current level (0..9)
    uint8_t lvl_clamped = (current_level > 9) ? 9 : (uint8_t)current_level;
    uint8_t xp_gain = s_xp_per_cast[lvl_clamped];

    current_xp += xp_gain;

    // Check level-up threshold at 100 XP
    if (current_xp >= 100) {
        current_xp -= 100;
        if (current_level < 9) {
            current_level++;
        } else {
            current_xp = 99; // Cap at 9:99
        }
    }

    write_wram16(lvl_addr, current_level);
    write_wram16(xp_addr, current_xp);
}
```
