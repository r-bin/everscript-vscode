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
> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/91CCD8](soe://rom/code/91CCD8?asm=1&c=0)


---

## 3. Reconstructed Clean C Implementation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/91/91CCD8_alchemy_formulas.c`](../../../reconstructed-c/91/91CCD8_alchemy_formulas.c).
> [View in VFS: soe://rom/code/91CCD8](soe://rom/code/91CCD8?c=1&asm=0)

