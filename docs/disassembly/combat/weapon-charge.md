# Weapon Charge, Stamina Gauge Math & String Profanity Filter ($8F:CC5D, $90:82D8, $8F:C02B, $80:B173)

> **Subsystem**: Combat & Character Mechanics Subsystem  
> **ROM Addresses**: `$8F:CC5D` (`recharge_entity_stamina`), `$90:82D8` (`select_attack_level_by_stamina`), `$8F:C02B` (`scale_damage_by_stamina`), `$80:B173` (`check_name_profanity`)  
> **Clean C Module**: `combat/weapon-charge.c`  
> **Recomp Symbol**: `func_C0B173_M0X0`, `bank_80_B21F_M0X0`  
> **Confidence**: Confirmed

---

## 1. Architectural Role

Secret of Evermore adopts the *Secret of Mana* real-time stamina bar combat model, with specific adaptations:
- **Stamina Gauge (`+0x2E`)**: Each entity tracks its weapon stamina in field `+0x2E`. A full 100% meter corresponds to `0x0400` (1024 decimal).
- **Per-Tick Recharge (`$8F:CC5D`)**: During the main entity tick loop, entities whose `mode` (`+$16`) has neither bit `$10` nor `$08` add the character record's `+$2E` (charge speed; not entity `+$2C`) until reaching `0x0400`.
- **Attack Level Selection (`$90:82D8`)**:
  - `Stamina < 0x0400` (< 100%): Level 0 basic weak jab/thrust.
  - `0x0400 <= Stamina < 0x0800` (100%): Standard weapon attack (Level 1).
  - `0x0800 <= Stamina < 0x0C00` (200%): Charged attack (Level 2).
  - `Stamina >= 0x0C00` (300%): Full weapon charge special attack (Level 3).
- **Attack Power Scaling (`$8F:C02B`)**: Attacking below 50% stamina (`< 0x0200`) divides attack power by 4 ($\div 4$), producing negligible chip damage. Full 100% stamina yields $1.0\times$ baseline damage. Higher charge tiers apply level multipliers.
- **Attack Swing Discharge (`$90:8495`)**: animation command `0x4E`, the **last** command of an attack script, empties the meter (`+$2E` = 0). While the attack plays its `mode` has bit `$10`, which stops recharging; an attack cut short by a hit never reaches `0x4E` and keeps its charge (corrected; see [docs/entities/combat.md](../../entities/combat.md) §2).
- **Name Profanity Check (`$80:B173`)**: The naming screen checks Boy and Dog names against forbidden substrings ("FUCK" / "fuck" case-insensitive) and sets flag bit 5 (`0x20`) in `$7E:22E9`.

---

## 2. Disassembly Analysis

```assembly
; ==============================================================================
; $8F:CC44: Recharge Entity Stamina Gauge (listing checked against the ROM; an earlier
; version here showed `ADC $002C,Y`, which is not what the ROM holds)
; ==============================================================================
$8F:CC44  B9 2A 00     LDA $002A,Y      ; HP
$8F:CC47  F0 2B        BEQ $CC74        ; dead: store A (0)
$8F:CC49  BE 60 00     LDX $0060,Y      ; character record
$8F:CC4C  B9 16 00     LDA $0016,Y      ; mode
$8F:CC4F  89 18 00     BIT #$0018       ; attacking ($10) or $08: no recharge
$8F:CC52  D0 23        BNE $CC77
$8F:CC54  B9 2E 00     LDA $002E,Y      ; current stamina
$8F:CC57  C9 00 04     CMP #$0400
$8F:CC5A  10 1B        BPL $CC77        ; already full
$8F:CC5C  18           CLC
$8F:CC5D  7F 2E 00 8E  ADC $8E002E,X    ; + the record's charge speed
$8F:CC61  C9 00 04     CMP #$0400
$8F:CC64  30 0E        BMI $CC74
$8F:CC66  CC 42 0F     CPY $0F42        ; the controlled character reaching full:
$8F:CC69  D0 06        BNE $CC71
$8F:CC6B  A9 0F 00     LDA #$000F       ;   $0B47 = 15
$8F:CC6E  8D 47 0B     STA $0B47
$8F:CC71  A9 00 04     LDA #$0400
$8F:CC74  99 2E 00     STA $002E,Y      ; store updated stamina

; ==============================================================================
; $90:82D8: Select Attack Level by Current Stamina
; ==============================================================================
$90:82D8  B9 2E 00     LDA $002E,Y      ; Load stamina
$90:82DB  C9 00 04     CMP #$0400       ; < 100%?
$90:82DE  90 12        BCC $82F2        ; Select attack Level 0 (+0x38)
$90:82E0  C9 00 08     CMP #$0800       ; < 200%?
$90:82E3  90 11        BCC $82F6        ; Select attack Level 1 (+0x3A)
$90:82E5  C9 00 0C     CMP #$0C00       ; < 300%?
$90:82E8  90 10        BCC $82FA        ; Select attack Level 2 (+0x3C)
$90:82EA  A9 3E 00     LDA #$003E       ; Select attack Level 3 (+0x3E)
$90:82ED  80 0E        BRA $82FD

; ==============================================================================
; $80:B173: Case-Insensitive String Profanity Check ("FUCK")
; ==============================================================================
$80:B173  E2 20        SEP #$20         ; 8-bit accumulator
$80:B175  8B           PHB
$80:B176  A5 24        LDA $24          ; Bank of target string
$80:B178  48           PHA
$80:B179  AB           PLB
$80:B17A  C2 20        REP #$20         ; 16-bit accumulator
$80:B17C  A4 22        LDY $22          ; Pointer to name string
$80:B17E  B9 00 00     LDA $0000,Y      ; First character
$80:B181  29 FF 00     AND #$00FF
$80:B184  F0 43        BEQ $B1C9        ; Null terminator reached -> no match
$80:B186  C9 46 00     CMP #$0046       ; 'F'?
$80:B189  F0 05        BEQ $B190
$80:B18B  C9 66 00     CMP #$0066       ; 'f'?
$80:B18E  D0 36        BNE $B1C6        ; No match -> advance Y
$80:B190  B9 01 00     LDA $0001,Y      ; Second character
$80:B193  29 FF 00     AND #$00FF
$80:B196  C9 55 00     CMP #$0055       ; 'U'?
$80:B198  F0 05        BEQ $B1A2
$80:B19B  C9 75 00     CMP #$0075       ; 'u'?
$80:B19E  D0 26        BNE $B1C6
$80:B1A2  B9 02 00     LDA $0002,Y      ; Third character
$80:B1A5  29 FF 00     AND #$00FF
$80:B1A8  C9 43 00     CMP #$0043       ; 'C'?
$80:B1AA  F0 05        BEQ $B1B4
$80:B1AD  C9 63 00     CMP #$0063       ; 'c'?
$80:B1B0  D0 14        BNE $B1C6
$80:B1B4  B9 03 00     LDA $0003,Y      ; Fourth character
$80:B1B7  29 FF 00     AND #$00FF
$80:B1BA  C9 4B 00     CMP #$004B       ; 'K'?
$80:B1BD  F0 0C        BEQ $B1CB        ; Match found!
$80:B1BF  C9 6B 00     CMP #$006B       ; 'k'?
$80:B1C2  F0 07        BEQ $B1CB        ; Match found!
$80:B1C6  C8           INY              ; Advance to next character
$80:B1C7  80 B5        BRA $B17E
$80:B1CB  AB           PLB              ; Restore data bank
$80:B1CC  A9 20 00     LDA #$0020       ; Set bit 5 of flag register
$80:B1CF  0D E9 22     ORA $22E9
$80:B1D2  8D E9 22     STA $22E9
$80:B1D5  6B           RTL
$80:B1C9  AB           PLB
$80:B1CA  6B           RTL
```

---

## 3. Clean C Implementation

```c
#include <stdint.h>
#include <stdbool.h>

#define STAMINA_100_PCT         0x0400  /* 1024 = 100% stamina */
#define STAMINA_50_PCT          0x0200  /* 512 = 50% threshold */
#define STAMINA_200_PCT         0x0800  /* Level 2 charge attack */
#define STAMINA_300_PCT         0x0C00  /* Level 3 charge attack */

#define FLAG_NAME_PROFANITY_BIT 0x0020  /* $7E:22E9 bit 5 */

/**
 * Recharges entity stamina during frame tick ($8F:CC5D).
 *
 * @param current_stamina Current stamina points (0..1024+).
 * @param charge_speed    Stamina recharge points added this frame.
 * @return Updated stamina points clamped to 100% (or current charge level).
 */
uint16_t recharge_entity_stamina(uint16_t current_stamina, uint16_t charge_speed) {
    if (current_stamina >= STAMINA_100_PCT) {
        return current_stamina; // Natural regen stops at 100%
    }
    uint32_t next = (uint32_t)current_stamina + (uint32_t)charge_speed;
    if (next > STAMINA_100_PCT) {
        next = STAMINA_100_PCT;
    }
    return (uint16_t)next;
}

/**
 * Picks attack animation level based on current stamina gauge ($90:82D8).
 *
 * @param stamina Current entity stamina points.
 * @return Attack level index (0, 1, 2, or 3).
 */
uint8_t select_attack_level_by_stamina(uint16_t stamina) {
    if (stamina < STAMINA_100_PCT) {
        return 0; // Low-stamina jab (< 100%)
    } else if (stamina < STAMINA_200_PCT) {
        return 1; // Standard weapon attack (100%)
    } else if (stamina < STAMINA_300_PCT) {
        return 2; // Level 2 charge attack (200%)
    } else {
        return 3; // Level 3 maximum charge attack (300%)
    }
}

/**
 * Scales base attack damage according to stamina percentage ($8F:C02B).
 *
 * @param base_power Raw calculated attack power before stamina scaling.
 * @param stamina    Attacker's stamina gauge (0..1024).
 * @return Scaled effective attack power.
 */
uint16_t scale_damage_by_stamina(uint16_t base_power, uint16_t stamina) {
    if (stamina < STAMINA_50_PCT) {
        // Under 50% stamina: severe quarter-power penalty (chip damage)
        return (base_power >> 2);
    } else if (stamina < STAMINA_100_PCT) {
        // Between 50% and 99%: linear interpolation between 25% and 100%
        uint32_t fraction = stamina - STAMINA_50_PCT; // 0..511
        uint32_t bonus = ((uint32_t)base_power * fraction * 3) / (STAMINA_50_PCT * 4);
        return (uint16_t)((base_power >> 2) + bonus);
    } else if (stamina >= STAMINA_300_PCT) {
        // Level 3 charge: 3x power multiplier
        return base_power * 3;
    } else if (stamina >= STAMINA_200_PCT) {
        // Level 2 charge: 2x power multiplier
        return base_power * 2;
    }
    return base_power; // 100% stamina: normal 1x damage
}

/**
 * Scans a null-terminated string for profanity ("FUCK" / "fuck") ($80:B173).
 * If detected, sets flag bit 5 in $7E:22E9.
 *
 * @param str Null-terminated ASCII character string.
 * @return True if profanity detected and flag was set.
 */
bool check_name_profanity(const char *str) {
    if (!str) return false;

    for (size_t i = 0; str[i] != '\0'; i++) {
        char c0 = str[i];
        if (c0 == 'F' || c0 == 'f') {
            char c1 = str[i + 1];
            if (c1 == 'U' || c1 == 'u') {
                char c2 = str[i + 2];
                if (c2 == 'C' || c2 == 'c') {
                    char c3 = str[i + 3];
                    if (c3 == 'K' || c3 == 'k') {
                        // Match detected! Set flag bit 5 in $7E:22E9
                        uint16_t flag = read_wram16(0x22E9);
                        write_wram16(0x22E9, flag | FLAG_NAME_PROFANITY_BIT);
                        return true;
                    }
                }
            }
        }
    }
    return false;
}
```
