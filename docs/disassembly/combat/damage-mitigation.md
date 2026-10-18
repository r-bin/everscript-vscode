# Combat Damage Mitigation & Hurtbox Resolution

- **ROM Location**: Bank `$91` (`$91:9C90` – `$91:9D0B`)
- **Primary Function**: `apply_spell_damage_to_targets` (`$91:9C90`)
- **Damage Pop-Up & Hurtbox Routine**: `inflict_actor_damage` (`$8F:C0D3`)
- **CPU State**: 16-bit A/X (`REP #$30`), Data Bank `$7E`
- **Hardware Registers**:
  - `$211B` / `$211C`: Mode 7 matrix multiplier inputs.
  - `$2135`: 16-bit multiplication high byte / product upper bits (effectively divides by 64).
- **Constants**:
  - `DAMAGE_MIN`: 1 HP
  - `DAMAGE_CAP`: 999 HP (`0x03E7`)
  - `BOY_SLOT_THRESHOLD`: `$4E89`

---

## 1. Architectural Architecture & Dual Defense Models

Secret of Evermore utilizes asymmetric combat damage calculations depending on whether the target is a player character or an enemy.

### 1. Player Characters (Boy `$4E89` & Dog `$4F37`)
For player characters, magic defense is a direct linear reduction:
$$\text{Net Damage} = \text{Spell Power} - \text{Target Magic Defense}$$

### 2. Enemy Hurtboxes
For enemies, magic defense operates as a 64-base fractional resistance ratio:
$$\text{Net Damage} = \frac{\text{Spell Power} \times (64 - \text{Target Magic Defense})}{64}$$
The game executes this fraction using the SNES PPU's hardware signed multiplier (`$211B`/`$211C`), reading the upper product byte directly from `$2135`.

### 3. Clamping & Resolution
- Any hit that deals damage is clamped to a minimum of **1 HP**.
- All hits are strictly clamped to a hard cap of **999 HP**.
- The routine invokes `$8F:C0D3` to decrement the actor's current HP, spawn on-screen damage numbers, and trigger knockback or death animations.

---

## 2. Disassembly & Annotations

```assembly
; ==============================================================================
; apply_spell_damage_to_targets ($91:9C90)
; Iterates active spell target list, computes defense reduction, clamps 1..999,
; and calls damage delivery subroutine.
; ==============================================================================
$919C90  84 6C       STY $6C           ; DP $6C = active spell slot pointer ($7E:3364+)
$919C92  BE 2E 00    LDX $002E,Y       ; Read target pointer
$919C95  F0 04       BEQ $919C9B       ; Null pointer -> start damage loop
$919C97  C8          INY
$919C98  C8          INY
$919C99  80 F7       BRA $919C92

$919C9B  A4 6C       LDY $6C
$919C9D  B9 2A 00    LDA $002A,Y       ; Load base spell power from slot +0x2A
$919CA0  85 02       STA $02           ; DP $02 = spell power
$919CA2  64 04       STZ $04           ; DP $04 = accumulated total damage
$919CA4  80 59       BRA $919CFF       ; Jump to target loop check

; Target Loop:
$919CA6  E0 89 4E    CPX #$4E89        ; Is target Boy or Dog (>= $4E89)?
$919CA9  90 0F       BCC $919CBA       ; No (Enemy) -> branch to fractional defense

; Player Linear Defense Mitigation:
$919CAB  DA          PHX
$919CAC  BD 60 00    LDA $0060,X       ; X = target actor armor record
$919CAF  AA          TAX
$919CB0  A5 02       LDA $02           ; A = spell power
$919CB2  38          SEC
$919CB3  FF 1D 00 8E SBC $8E001D,X     ; Subtract player magic defense directly
$919CB7  FA          PLX
$919CB8  80 25       BRA $919CDF

; Enemy Fractional Defense Mitigation (Power * (64 - MDef) / 64):
$919CBA  DA          PHX
$919CBB  BD 60 00    LDA $0060,X       ; X = enemy stat record
$919CBE  AA          TAX
$919CBF  A5 02       LDA $02           ; A = spell power
$919CC1  0A          ASL A
$919CC2  0A          ASL A             ; Power << 2
$919CC3  E2 21       SEP #$21          ; 8-bit Accumulator, clear carry
$919CC5  8F 1B 21 00 STA $00211B       ; Mode 7 Multiplier input low
$919CC9  EB          XBA
$919CCA  8F 1B 21 00 STA $00211B       ; Mode 7 Multiplier input high
$919CCE  A9 40       LDA #$40          ; 64 base defense scale
$919CD0  FF 1D 00 8E SBC $8E001D,X     ; 64 - Enemy Magic Defense
$919CD4  8F 1C 21 00 STA $00211C       ; Multiplier second operand
$919CD8  C2 30       REP #$30          ; 16-bit A/X
$919CDA  AF 35 21 00 LDA $002135       ; Read product upper byte (divided by 64)
$919CDE  FA          PLX

; Clamp Damage 1..999:
$919CDF  C9 01 00    CMP #$0001        ; Under 1?
$919CE2  10 03       BPL $919CE7
$919CE4  A9 01 00    LDA #$0001        ; Minimum 1 damage!
$919CE7  C9 E7 03    CMP #$03E7        ; Over 999?
$919CEA  30 03       BMI $919CEF
$919CEC  A9 E7 03    LDA #$03E7        ; Clamped to 999!

; Deliver Damage & Damage Numbers:
$919CEF  5A          PHY
$919CF0  9B          TXY               ; Y = target entity pointer
$919CF1  48          PHA               ; Preserve net damage
$919CF2  22 D3 C0 8F JSL $8FC0D3       ; Apply HP subtraction, numbers, hurt anim
$919CF6  68          PLA               ; Restore net damage
$919CF7  7A          PLY
$919CF8  18          CLC
$919CF9  65 04       ADC $04           ; Accumulate total spell damage
$919CFB  85 04       STA $04
$919CFD  C8          INY
$919CFE  C8          INY

$919CFF  BE 2E 00    LDX $002E,Y       ; Next target
$919D02  D0 A2       BNE $919CA6       ; Loop until all targets resolved

; Complete:
$919D04  7A          PLY
$919D05  A5 04       LDA $04
$919D07  99 2A 00    STA $002A,Y       ; Store total damage to slot +0x2A
$919D0A  18          CLC
$919D0B  60          RTS
```

---

## 3. Reconstructed Clean C Implementation

```c
#include <stdint.h>
#include <stdbool.h>

#define BOY_ACTOR_THRESHOLD 0x4E89
#define MIN_DAMAGE          1
#define MAX_DAMAGE_CAP      999

typedef struct {
    uint16_t spell_power; // +0x2A: Base spell power
    uint16_t targets[8];  // +0x2E: Null-terminated list of target entity addresses
} SpellEffectSlot;

typedef struct {
    uint16_t current_hp;  // Actor HP
    uint16_t max_hp;
} ActorStats;

extern const uint8_t g_stat_tables[0x20000]; // Bank $8E stat data
extern void inflict_actor_damage(uint16_t target_entity, uint16_t damage);

/**
 * Calculates defense reduction, clamps damage 1..999, and applies damage to targets.
 * Corresponds to $91:9C90.
 */
void apply_spell_damage_to_targets(SpellEffectSlot *slot) {
    uint16_t power = slot->spell_power;
    uint32_t total_damage = 0;

    for (int i = 0; i < 8; i++) {
        uint16_t target_ptr = slot->targets[i];
        if (target_ptr == 0) {
            break; // End of target list
        }

        int32_t net_damage;

        if (target_ptr >= BOY_ACTOR_THRESHOLD) {
            // Player Character (Boy or Dog): Direct linear subtraction
            uint16_t stat_offset = *(const uint16_t *)(g_stat_tables + target_ptr + 0x60);
            uint8_t mdef = g_stat_tables[0x1D + stat_offset];
            net_damage = (int32_t)power - mdef;
        } else {
            // Enemy Hurtbox: Fractional defense reduction (Power * (64 - MDef) / 64)
            uint16_t stat_offset = *(const uint16_t *)(g_stat_tables + target_ptr + 0x60);
            uint8_t mdef = g_stat_tables[0x1D + stat_offset];
            if (mdef > 64) mdef = 64;

            net_damage = ((int32_t)power * (64 - mdef)) / 64;
        }

        // Clamp Damage between 1 and 999
        if (net_damage < MIN_DAMAGE) {
            net_damage = MIN_DAMAGE;
        } else if (net_damage > MAX_DAMAGE_CAP) {
            net_damage = MAX_DAMAGE_CAP;
        }

        // Inflict damage, spawn floating combat text, trigger hurt state ($8F:C0D3)
        inflict_actor_damage(target_ptr, (uint16_t)net_damage);
        total_damage += (uint32_t)net_damage;
    }

    slot->spell_power = (uint16_t)total_damage;
}
```
