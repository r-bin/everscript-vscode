# Alchemy Formula Available Casts, Palette Grey-Out, and Experience Growth ($91:CE38, $90:878C, $91:CD44)

## 1. Subsystem Architecture Overview

The Secret of Evermore Alchemy engine enforces ingredient constraints, inventory counts, and formula level progression through a multi-tiered pipeline:

1. **Available Casts Ratio Calculator (`$91:CE38` – `$91:CE90`)**:
   - Takes formula ID in accumulator `A` (step 2, `0x00`..`0x44` for 35 formulas).
   - Reads 4-byte cost record from `$C4:601F + (formula_id * 2)`:
     - `+$00`: Ingredient 1 ID (`DP $02`)
     - `+$01`: Ingredient 2 ID (`DP $03`)
     - `+$02`: Ingredient 1 Required Quantity (`DP $04`)
     - `+$03`: Ingredient 2 Required Quantity (`DP $05`)
   - Queries player inventory counters at `$7E:22FF + ingredient_id`.
   - Performs hardware 16-bit unsigned division via SNES PPU math registers (`$4204` dividend / `$4206` divisor, reading quotient from `$4214`).
   - Yields individual ingredient cast ratios $Q_1$ and $Q_2$.
   - Evaluates $\min(Q_1, Q_2)$, returning the maximum usable cast count in accumulator `A`.

2. **Ring Menu Icon Animation Opcode `0x56` (`$90:878C` – `$90:87B7`)**:
   - Executes during ring menu rendering for alchemy formula icons.
   - Calls `alchemy_formula_calc_available_casts` (`$91:CE38`).
   - If available casts $< 1$ (accumulator is zero):
     - Loads monochrome greyscale palette pointer `$D0:A8EB` into entity `+0x0C`.
     - Renders the formula icon disabled/greyed-out.
   - If available casts $\ge 1$:
     - Retains full-color active palette.

3. **Formula Cast Experience & Mastery Progression (`$91:CD44` – `$91:CDC6`)**:
   - Executed upon successful formula casting.
   - Queries current formula level $L$ from `$7E:2F98,X` ($0 \dots 9$).
   - Looks up XP gain per cast from ROM table `$C4:5B9C,X`:
     `[10, 5, 4, 3, 2, 2, 1, 1, 1, 1]`.
   - Accumulates XP into `$7E:2F52,X`.
   - If accumulated XP $\ge 100$:
     - Subtracts 100 and increments formula level `$7E:2F98,X` (capped at Level 9).
     - Triggers level-up chime SFX via `$80:B37A`.
     - Displays level-up banner string from table `$C4:5D09,X`.

---

## 2. 65816 Disassembly Analysis

```assembly
; ==============================================================================
; alchemy_formula_calc_available_casts ($91:CE38 - $91:CE90)
; Computes maximum possible casts based on current ingredient inventory.
; Input: A = formula index (step 2: 0, 2, 4 ... 68)
; Output: A = available casts = min(inv[ing1] / cost[ing1], inv[ing2] / cost[ing2])
; ==============================================================================
$91:CE38  0A           ASL A               ; Multiply by 2 -> stride 4 table index
$91:CE39  AA           TAX
$91:CE3A  BF 21 60 C4  LDA $C46021,X       ; Load Ing1_Qty (low) and Ing2_Qty (high)
$91:CE3E  85 04        STA $04             ; DP $04 = Ing1_Qty, DP $05 = Ing2_Qty
$91:CE40  BF 1F 60 C4  LDA $C4601F,X       ; Load Ing1_ID (low) and Ing2_ID (high)
$91:CE44  85 02        STA $02             ; DP $02 = Ing1_ID, DP $03 = Ing2_ID

; Division 1: Ingredient 1
$91:CE46  29 FF 00     AND #$00FF          ; Mask Ing1_ID
$91:CE49  AA           TAX
$91:CE4A  E2 20        SEP #$20            ; 8-bit accumulator
$91:CE4C  BF FF 22 7E  LDA $7E22FF,X       ; Load player inventory of Ing 1
$91:CE50  8D 04 42     STA $4204           ; SNES dividend low byte
$91:CE53  A9 00        LDA #$00
$91:CE55  8D 05 42     STA $4205           ; SNES dividend high byte = 0
$91:CE58  A5 04        LDA $04             ; Required quantity of Ing 1
$91:CE5A  8D 06 42     STA $4206           ; SNES divisor (initiates 16-cycle division)
$91:CE5D  C2 20        REP #$20            ; 16-bit accumulator
$91:CE5F  EA EA        NOP : NOP           ; Wait hardware division cycles
$91:CE61  EA EA        NOP : NOP
$91:CE63  AD 14 42     LDA $4214           ; Load hardware quotient (available casts from Ing 1)
$91:CE66  85 12        STA $12             ; Save quotient 1 into DP $12

; Division 2: Ingredient 2
$91:CE68  A5 03        LDA $03             ; Load Ing2_ID from DP $03
$91:CE6A  29 FF 00     AND #$00FF
$91:CE6D  AA           TAX
$91:CE6E  E2 20        SEP #$20            ; 8-bit accumulator
$91:CE70  BF FF 22 7E  LDA $7E22FF,X       ; Load player inventory of Ing 2
$91:CE74  8D 04 42     STA $4204           ; Dividend low byte
$91:CE77  A9 00        LDA #$00
$91:CE79  8D 05 42     STA $4205           ; Dividend high byte = 0
$91:CE7C  A5 05        LDA $05             ; Required quantity of Ing 2
$91:CE7E  8D 06 42     STA $4206           ; Divisor
$91:CE81  C2 20        REP #$20            ; 16-bit accumulator
$91:CE83  EA EA        NOP : NOP
$91:CE85  EA EA        NOP : NOP
$91:CE87  AD 14 42     LDA $4214           ; Load hardware quotient 2

; Minimum Comparison: min(Q1, Q2)
$91:CE8A  C5 12        CMP $12             ; Compare Q2 with Q1
$91:CE8C  30 02        BMI $91CE90         ; If Q2 < Q1, keep Q2 in A
$91:CE8E  A5 12        LDA $12             ; Otherwise, take Q1 from DP $12
$91:CE90  6B           RTL                 ; Return available casts in A

; ==============================================================================
; Ring Menu Icon Disabled Palette Check (Opcode 0x56, $90:878C - $90:87B7)
; ==============================================================================
$90:878C  8B           PHB
$90:878D  4B           PHK
$90:878E  AB           PLB                 ; Set DB = $90
$90:878F  BD 00 00     LDA $0000,X         ; Read formula index argument
$90:8792  E8 E8        INX : INX           ; Advance bytecode pointer by 2 bytes
$90:8794  22 38 CE 91  JSL $91CE38         ; Call alchemy_formula_calc_available_casts
$90:8798  AB           PLB                 ; Restore DB
$90:8799  C9 01 00     CMP #$0001          ; At least 1 cast available?
$90:879C  10 09        BPL $9087A7         ; If >= 1, keep normal color palette
$90:879E  A9 EB A8     LDA #$A8EB          ; Disabled greyscale palette offset ($D0:A8EB)
$90:87A1  99 0C 00     STA $000C,Y         ; Assign palette override to icon entity +$0C
$90:87A4  6B           RTL
$90:87A7  6B           RTL

; ==============================================================================
; Formula Experience & Level Up Progression ($91:CD44 - $91:CDC6)
; ==============================================================================
$91:CD44  5A           PHY
$91:CD45  BF 98 2F 7E  LDA $7E2F98,X       ; Current formula level (0..9)
$91:CD49  DA           PHX
$91:CD4A  AA           TAX
$91:CD4B  BF 9C 5B C4  LDA $C45B9C,X       ; XP gain per cast for this level
$91:CD4F  29 FF 00     AND #$00FF
$91:CD52  FA           PLX
$91:CD53  18           CLC
$91:CD54  7F 52 2F 7E  ADC $7E2F52,X       ; Add to formula XP counter ($7E:2F52)
$91:CD58  C9 64 00     CMP #$0064          ; Reached 100 XP?
$91:CD5B  30 69        BMI $91CDC6         ; If < 100, no level up
$91:CD5D  38           SEC
$91:CD5E  E9 64 00     SBC #$0064          ; Carry over excess XP
$91:CD61  9F 52 2F 7E  STA $7E2F52,X
$91:CD65  BF 98 2F 7E  LDA $7E2F98,X       ; Current level
$91:CD69  1A           INC A               ; Level up!
$91:CD6A  C9 09 00     CMP #$0009          ; Max Level 9
$91:CD6D  90 03        BCC $91CD72
$91:CD6F  A9 09 00     LDA #$0009
$91:CD72  9F 98 2F 7E  STA $7E2F98,X       ; Store new level
$91:CD76  22 7A B3 80  JSL $80B37A         ; Trigger level-up chime sound
$91:CD7A  7A           PLY
$91:CD7B  6B           RTL
```

---

## 3. Clean C Reconstructed Implementation

```c
#include <stdint.h>
#include <stdbool.h>

#define MAX_FORMULAS        35
#define MAX_FORMULA_LEVEL   9
#define XP_PER_LEVEL        100
#define DISABLED_PALETTE    0xA8EB  /* Bank $D0:A8EB greyscale palette */

/* ROM Tables (Bank $C4) */
typedef struct {
    uint8_t ing1_id;
    uint8_t ing2_id;
    uint8_t ing1_qty;
    uint8_t ing2_qty;
} AlchemyIngredientCost;

extern const AlchemyIngredientCost g_alchemy_costs[MAX_FORMULAS]; /* $C4:601F */
extern const uint8_t g_alchemy_xp_gain[10];                      /* $C4:5B9C: [10, 5, 4, 3, 2, 2, 1, 1, 1, 1] */
extern const uint16_t g_alchemy_name_ptrs[MAX_FORMULAS];         /* $C4:5D09 */

/* WRAM State */
typedef struct {
    uint8_t  inventory_ingredients[256]; /* $7E:22FF + ID */
    uint16_t formula_xp[MAX_FORMULAS];    /* $7E:2F52 + (ID * 2) */
    uint16_t formula_level[MAX_FORMULAS]; /* $7E:2F98 + (ID * 2) */
} AlchemyGameState;

extern AlchemyGameState g_alchemy_state;

/* Sound & Notification Engine */
extern void sound_play_chime(uint16_t sfx_id); /* $80:B37A */

/**
 * Calculates the maximum number of times a formula can be cast given current ingredient stock.
 * Corresponds to native routine $91:CE38.
 *
 * @param formula_index Step-2 formula identifier (0, 2, 4, ..., 68).
 * @return Available casts (0 if out of ingredients, or min ratio of ingredients).
 */
uint16_t alchemy_formula_calc_available_casts(uint16_t formula_index) {
    uint16_t table_index = formula_index >> 1; // Convert step-2 to step-1
    if (table_index >= MAX_FORMULAS) {
        return 0;
    }

    const AlchemyIngredientCost *cost = &g_alchemy_costs[table_index];

    // Evaluate Ingredient 1
    uint8_t inv1 = g_alchemy_state.inventory_ingredients[cost->ing1_id];
    uint16_t casts1 = (cost->ing1_qty > 0) ? (inv1 / cost->ing1_qty) : 999;

    // Evaluate Ingredient 2
    uint8_t inv2 = g_alchemy_state.inventory_ingredients[cost->ing2_id];
    uint16_t casts2 = (cost->ing2_qty > 0) ? (inv2 / cost->ing2_qty) : 999;

    // Usable casts is the limiting ingredient
    uint16_t available_casts = (casts1 < casts2) ? casts1 : casts2;
    return available_casts;
}

/**
 * Ring menu icon animation opcode 0x56 handler ($90:878C).
 * Updates icon palette based on cast availability.
 *
 * @param icon_entity Pointer to ring menu icon entity record.
 * @param formula_index Formula identifier.
 */
void alchemy_icon_palette_greyout_check(void *icon_entity, uint16_t formula_index) {
    typedef struct {
        uint8_t pad[12];
        uint16_t palette_override; /* +$0C */
    } RingIconEntity;

    RingIconEntity *icon = (RingIconEntity *)icon_entity;
    uint16_t available = alchemy_formula_calc_available_casts(formula_index);

    if (available == 0) {
        // Disabled: grey out icon with monochrome palette
        icon->palette_override = DISABLED_PALETTE;
    }
}

/**
 * Awards formula experience on cast and handles mastery level ups ($91:CD44).
 *
 * @param formula_index Step-2 formula identifier.
 * @return True if formula leveled up, false otherwise.
 */
bool alchemy_formula_award_cast_xp(uint16_t formula_index) {
    uint16_t slot = formula_index >> 1;
    if (slot >= MAX_FORMULAS) {
        return false;
    }

    uint16_t current_level = g_alchemy_state.formula_level[slot];
    if (current_level > MAX_FORMULA_LEVEL) {
        current_level = MAX_FORMULA_LEVEL;
    }

    uint8_t xp_gain = g_alchemy_xp_gain[current_level];
    uint16_t new_xp = g_alchemy_state.formula_xp[slot] + xp_gain;

    if (new_xp >= XP_PER_LEVEL) {
        // Level up occurred!
        new_xp -= XP_PER_LEVEL;
        g_alchemy_state.formula_xp[slot] = new_xp;

        if (current_level < MAX_FORMULA_LEVEL) {
            g_alchemy_state.formula_level[slot] = current_level + 1;
        }

        // Play level up chime
        sound_play_chime(0x0012);
        return true;
    } else {
        g_alchemy_state.formula_xp[slot] = new_xp;
        return false;
    }
}
```

---

## 4. Architectural Invariants & Memory Anchors

- **Direct Page Workspace**:
  - `DP $02`: Low byte holds Ingredient 1 ID, high byte holds Ingredient 2 ID.
  - `DP $04`: Low byte holds Ingredient 1 Required Quantity, high byte holds Ingredient 2 Required Quantity.
  - `DP $12`: Temporary register storing quotient $Q_1$ during hardware division of Ingredient 2.
- **Hardware PPU Division Timing**:
  - The SNES CPU requires 16 master cycles between storing divisor `$4206` and reading quotient `$4214`.
  - The routines insert `REP #$20` and 4 `NOP` instructions ($3 + 8 = 11$ cycles) plus addressing latency to guarantee quotient stability before reading.
- **Ring Menu Visual Feedback**:
  - When a player depletes ingredients for an equipped formula, opcode `0x56` automatically intercepts the render pass and assigns palette `$D0:A8EB`.
  - Upon purchasing or collecting required ingredients, subsequent frames re-evaluate `$91:CE38` yielding $> 0$, immediately restoring the vibrant palette without needing ring menu closure.
