# Weapon Swapping & Ring Menu Sub-Item Selector

> **ROM Bank**: `$8E` (Ring Menu Handlers), `$8C` (Audio Dispatch)  
> **Source Routines**: `$8E:8F50` (`ring_menu_subitem_select`), `$8E:9000` (`weapon_equip_and_experience_update`)  
> **Related Routines**: `$8E:8D80` (Cost validator), `$8C:82DC` (Direct sound effect trigger), `$8C:9E03` (Menu string renderer)  
> **Memory Map**: `$7E:0AC6` (Current weapon skill experience), `$7E:0AC8` (Weapon skill level), `$7E:231C` (Equipped weapon ID), `$7E:2348` (Held weapons bitfield), `$7E:05A9` (System interaction mode, bit 6: rejection buzz)

---

## 1. Architectural Overview

Weapon switching in *Secret of Evermore* is managed through the character's circular **Ring Menu** subsystem in Bank `$8E`. When the player highlights a weapon category (Swords, Axes, Spears, or Bazookas) and presses the action button, the engine evaluates whether the hero currently owns that specific weapon variant, updates the equipped weapon register, recalculates active weapon experience, and plays an equip confirmation sound effect.

### Key Subsystems:
1. **Ownership & Eligibility Validation (`$8E:8F50`)**:
   - The selected ring slot index in `$12` is shifted and converted into an inventory item index: `A = (item_index >> 1) - 1`.
   - Reads the held item count / ownership byte from `$7E:231D,x`.
   - Compares against maximum allowance (`CMP #$07`). If the weapon is locked or unacquired, the engine asserts error rejection bit `0x0020` in `$05A9`, triggering an error buzz sound and keeping the current weapon equipped.
2. **Weapon Equipping & Stat Refresh (`$8E:9000`)**:
   - Compares the selected weapon ID against currently equipped weapon registers `$0AC4` and `$0ABE`.
   - If a new weapon is confirmed:
     - Updates the equipped weapon slot at `$7E:231C,x`.
     - Validates weapon attack eligibility (`CMP #$0002`).
     - Loads accumulated weapon skill experience from `$7E:2348` and updates live combat registers `$0AC6,x` and `$0AC8,x`.
3. **Sound Effect & UI Feedback (`$8E:9046`)**:
   - Upon successfully equipping the weapon, accumulator `A` is loaded with sound effect ID `#$0043` (Equip Clink).
   - Invokes direct sound effect dispatcher `JSL $8C82DC` to play the confirmation tone without disrupting active background music.
   - Triggers redraw of weapon level Roman numerals (Level 1..3) in the active status window.

---

## 2. 65816 Assembly Implementation

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8E8F50](soe://rom/code/8E8F50?asm=1&c=0)


---

## 3. Clean C Decompilation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8E/8E8F50_weapon_select.c`](../../../reconstructed-c/8E/8E8F50_weapon_select.c).
> [View in VFS: soe://rom/code/8E8F50](soe://rom/code/8E8F50?c=1&asm=0)

