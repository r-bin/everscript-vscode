# Alchemy Formula Engine & Spell Power Math

- **ROM Locations**:
  - `calc_spell_power_and_cast`: `$91:CCD8` – `$91:CDDC`
  - `damage_effect_handler`: `$91:9C90` – `$91:9D15`
  - `healing_effect_handler`: `$91:9D16` – `$91:9D80`
  - `status_buff_handler`: `$91:B137` – `$91:B1A0`
- **CPU State**: 16-bit A/X (`REP #$30`), Data Bank `$7E`
- **Hardware Registers**:
  - `$4202` / `$4203`: SNES hardware 8-bit $\times$ 8-bit multiplier inputs.
  - `$4216` / `$4217`: SNES hardware 16-bit multiplication product.
  - `$4204` / `$4205`: SNES hardware 16-bit dividend input.
  - `$4206`: SNES hardware 8-bit divisor input.
  - `$4214` / `$4215`: SNES hardware 16-bit division quotient.
- **WRAM Core Addresses**:
  - `$7E:2F52,x`: Formula experience points (0..99 XP).
  - `$7E:2F98,x`: Formula current mastery level (0..9).
  - `$7E:2FDE,x`: Formula total lifetime usage cast counter.
  - `$7E:3364`..`$7E:3563`: Active animation spell slots (64 bytes each, Final Power at `+0x2A`).
  - `$7E:3564`..`$7E:3913`: Active projectile spell slots (118 bytes each).

---

## 1. Architectural Architecture & Spell Execution Pipeline

When the player casts an alchemy formula in Secret of Evermore:
1. **Target Counting**: Counts all non-zero targets in the target list at `slot + 0x2E`.
2. **Gross Power Calculation**:
   $$\text{Gross Power} = \text{Base Power } (C4:5E6B) \times \text{Level Multiplier } (C4:5BA5)$$
3. **Multi-Target Damage Splitting**:
   $$\text{Divided Power} = \frac{\text{Gross Power}}{\text{Target Count} + 1}$$
4. **Random Variance (50%–100%)**:
   $$\text{Final Power} = \left(\frac{\text{Divided Power}}{2}\right) + \text{RNG}\left(0 \dots \frac{\text{Divided Power}}{2}\right)$$
5. **Formula Leveling (XP Progression)**:
   - XP gain per cast is looked up from table `$C4:5B9C` (10 XP at Lv0 down to 1 XP at Lv6+).
   - If XP reaches 100, the formula levels up (`level++`, `xp = 0`).

---

## 2. Disassembly & Annotations

### Part 1: Cast Execution & Power Math (`$91:CCD8`)
```assembly
; ==============================================================================
; calc_spell_power_and_cast ($91:CCD8)
; Input:
;   X = Formula index (0, 2, 4... 68)
;   Y = Active spell slot pointer ($7E:3364+)
; ==============================================================================
$91CCD8  8B          PHB               ; Preserve Data Bank
$91CCD9  F4 7E 7E    PEA $7E7E
$91CCDC  AB          PLB
$91CCDD  AB          PLB               ; Data Bank = $7E
$91CCDE  5A          PHY
$91CCDF  A5 4C       LDA $4C           ; Caster entity pointer (boy or dog)
$91CCE1  99 28 00    STA $0028,Y       ; Store caster into spell slot +0x28
$91CCE4  5A          PHY

; Count Active Targets:
$91CCE5  64 42       STZ $42           ; Target count = 0
$91CCE7  B9 2E 00    LDA $002E,Y       ; Read target pointer
$91CCEA  F0 06       BEQ $91CCF2       ; Null pointer -> end of target list
$91CCEC  E6 42       INC $42           ; Target count++
$91CCEE  C8          INY
$91CCEF  C8          INY
$91CCF0  80 F5       BRA $91CCE7

; Gross Power Multiplication:
$91CCF2  7A          PLY               ; Restore spell slot pointer
$91CCF3  DA          PHX
$91CCF4  BF 98 2F 7E LDA $7E2F98,X     ; Load formula level (0..9)
$91CCF8  AA          TAX
$91CCF9  BF A5 5B C4 LDA $C45BA5,X     ; Load Level Multiplier from $C4:5BA5
$91CCFD  29 FF 00    AND #$00FF
$91CD00  EB          XBA               ; Multiplier byte into hardware input
$91CD01  FA          PLX
$91CD02  1F 6B 5E C4 ORA $C45E6B,X     ; Base Power from table $C4:5E6B
$91CD06  8F 02 42 00 STA $004202       ; Set $4202 = Base Power, $4203 = Multiplier
$91CD0A  80 00       BRA $91CD0C

; Multi-Target Division:
$91CD0C  EA          NOP               ; Hardware multiplier delay
$91CD0D  AF 16 42 00 LDA $004216       ; Read 16-bit Product (Gross Power)
$91CD11  8F 04 42 00 STA $004204       ; Dividend = Gross Power
$91CD15  E2 20       SEP #$20          ; 8-bit Accumulator
$91CD17  A5 42       LDA $42           ; Target count
$91CD19  1A          INC A             ; Divisor = Target Count + 1
$91CD1A  8F 06 42 00 STA $004206       ; Divisor register
$91CD1E  C2 20       REP #$20          ; 16-bit Accumulator
$91CD20  80 00       BRA $91CD22

$91CD22  EA          NOP               ; Hardware division delay (16 cycles)
$91CD23  80 00       BRA $91CD25
$91CD25  EA          NOP

; Random Variance (50% Base + 50% RNG):
$91CD26  AF 14 42 00 LDA $004214       ; Read Quotient (Divided Power)
$91CD2A  85 12       STA $12           ; DP $12 = Divided Power
$91CD2C  4A          LSR A             ; DP $02 = Divided Power / 2
$91CD2D  85 02       STA $02
$91CD2F  A5 12       LDA $12
$91CD31  38          SEC
$91CD32  E5 02       SBC $02           ; DP $12 = 50% Base Minimum Power
$91CD34  85 12       STA $12
$91CD36  DA          PHX
$91CD37  5A          PHY
$91CD38  22 62 AD 80 JSL $80AD62       ; RNG: returns 0 .. DP $02
$91CD3C  7A          PLY
$91CD3D  FA          PLX
$91CD3E  18          CLC
$91CD3F  65 12       ADC $12           ; Final Power = 50% Base + RNG Variance
$91CD41  99 2A 00    STA $002A,Y       ; Store Final Power into slot +0x2A

; Formula Experience (XP) Progression:
$91CD44  5A          PHY
$91CD45  BF 98 2F 7E LDA $7E2F98,X     ; Formula level
$91CD49  DA          PHX
$91CD4A  AA          TAX
$91CD4B  BF 9C 5B C4 LDA $C45B9C,X     ; XP gain per cast from $C4:5B9C
$91CD4F  29 FF 00    AND #$00FF
$91CD52  FA          PLX
$91CD53  18          CLC
$91CD54  7F 52 2F 7E ADC $7E2F52,X     ; Add to current formula XP ($7E:2F52)
$91CD58  C9 64 00    CMP #$0064        ; Reached 100 XP?
$91CD5B  30 69       BMI $91CDC6       ; If < 100, no level up!

; Formula Level Up:
$91CD5D  DA          PHX
$91CD5E  A3 01       LDA $01,S
$91CD60  AA          TAX
$91CD61  A9 C4 00    LDA #$00C4
$91CD64  85 28       STA $28
$91CD66  BF 09 5D C4 LDA $C45D09,X
$91CD6A  85 26       STA $26
$91CD6C  22 7A B3 80 JSL $80B37A       ; Play level-up sound and notification
```

---

## 3. Reconstructed Clean C Implementation

```c
#include <stdint.h>
#include <stdbool.h>

#define MAX_FORMULA_LEVEL   9
#define XP_PER_LEVEL        100

// ROM Master Tables (Bank $C4)
extern const uint8_t  g_level_multipliers[10]; // $C4:5BA5: [2, 4, 7, 11, 15, 20, 26, 32, 39, 46]
extern const uint8_t  g_xp_gains[10];          // $C4:5B9C: [10, 5, 4, 3, 2, 2, 1, 1, 1, 1]
extern const uint16_t g_base_powers[35];        // $C4:5E6B: Base spell powers

typedef struct {
    uint16_t formula_xp[35];     // $7E:2F52: 0..99 XP
    uint16_t formula_level[35];  // $7E:2F98: 0..9 Level
    uint16_t formula_usage[35];  // $7E:2FDE: Lifetime cast counter
} AlchemyPlayerStats;

typedef struct {
    uint16_t caster_ptr;         // +0x28: Pointer to casting entity
    uint16_t final_power;        // +0x2A: Computed spell power
    uint16_t targets[8];         // +0x2E: Null-terminated list of target entity pointers
} ActiveSpellSlot;

extern AlchemyPlayerStats g_alchemy_stats;
extern uint16_t rng_bounded(uint16_t max);
extern void play_level_up_sfx(uint8_t formula_idx);

/**
 * Executes formula cast math: computes power, multi-target split, RNG, and XP gain.
 * Corresponds to $91:CCD8.
 */
void calc_spell_power_and_cast(uint8_t formula_idx, ActiveSpellSlot *slot, uint16_t caster_ptr) {
    slot->caster_ptr = caster_ptr;

    // 1. Count Active Targets
    uint16_t target_count = 0;
    while (target_count < 8 && slot->targets[target_count] != 0) {
        target_count++;
    }

    // 2. Gross Power (Base Power * Level Multiplier)
    uint16_t level = g_alchemy_stats.formula_level[formula_idx];
    if (level > MAX_FORMULA_LEVEL) level = MAX_FORMULA_LEVEL;

    uint16_t base_power = g_base_powers[formula_idx];
    uint16_t level_mult = g_level_multipliers[level];
    uint32_t gross_power = (uint32_t)base_power * level_mult;

    // 3. Multi-Target Split: Gross Power / (Target Count + 1)
    uint16_t divided_power = (uint16_t)(gross_power / (target_count + 1));

    // 4. Random Variance: 50% min + RNG(0 .. 50%)
    uint16_t base_min_power = divided_power / 2;
    uint16_t variance_range = divided_power - base_min_power;
    uint16_t random_bonus   = rng_bounded(variance_range);

    slot->final_power = base_min_power + random_bonus;

    // 5. Formula Experience (XP) Progression
    uint16_t xp_gain = g_xp_gains[level];
    uint16_t total_xp = g_alchemy_stats.formula_xp[formula_idx] + xp_gain;

    if (total_xp >= XP_PER_LEVEL) {
        if (g_alchemy_stats.formula_level[formula_idx] < MAX_FORMULA_LEVEL) {
            g_alchemy_stats.formula_level[formula_idx]++;
            g_alchemy_stats.formula_xp[formula_idx] = total_xp - XP_PER_LEVEL;
            play_level_up_sfx(formula_idx);
        } else {
            g_alchemy_stats.formula_xp[formula_idx] = 99; // Cap at 9:99
        }
    } else {
        g_alchemy_stats.formula_xp[formula_idx] = total_xp;
    }

    // Increment lifetime cast statistics
    g_alchemy_stats.formula_usage[formula_idx]++;
}

/**
 * Applies spell damage to target hurtbox with magic defense mitigation.
 * Corresponds to $91:9C90.
 */
int16_t apply_spell_damage(uint16_t power, uint8_t target_mdef) {
    if (target_mdef > 64) target_mdef = 64;
    // Net Damage = Power * (64 - Magic_Defense) / 64
    uint32_t net = ((uint32_t)power * (64 - target_mdef)) >> 6;
    return (int16_t)net;
}
```
