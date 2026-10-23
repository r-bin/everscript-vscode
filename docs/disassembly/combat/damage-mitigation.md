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

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/919C90](soe://rom/code/919C90?asm=1&c=0)


---

## 3. Reconstructed Clean C Implementation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/91/919C90_damage_mitigation.c`](../../../reconstructed-c/91/919C90_damage_mitigation.c).
> [View in VFS: soe://rom/code/919C90](soe://rom/code/919C90?c=1&asm=0)

