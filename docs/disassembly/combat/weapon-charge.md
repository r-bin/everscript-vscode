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

The host model for `$80:B173` is `check_name_profanity` in [`8FCC5D_weapon_charge.c`](../../../reconstructed-c/8F/8FCC5D_weapon_charge.c). It stops at the first NUL even during a partial candidate and retries from the next byte after a mismatch, so overlapping candidates are considered. On a full match, the routine sets bit 5 with a 16-bit `ORA`/`STA` at `$7E:22E9`; the model therefore accepts a pointer to the full flag word and leaves its other bits unchanged.

---

## 2. Disassembly Analysis

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8FCC5D](soe://rom/code/8FCC5D?asm=1&c=0)


---

## 3. Clean C Implementation

> **Reconstructed C Decompilation**:
> Source: [`reconstructed-c/8F/8FCC5D_weapon_charge.c`](../../../reconstructed-c/8F/8FCC5D_weapon_charge.c), including `check_name_profanity` for `$80:B173`.
> [View in VFS: soe://rom/code/8FCC5D](soe://rom/code/8FCC5D?c=1&asm=0)

