# Dynamic Buff Persistence, Weapon Equip & Stamina Initialization Engine ($8F:9210 – $8F:935E)

## 1. Subsystem Architecture Overview

The equipment and status synchronization pipeline in Bank `$8F` (`$8F:9210` – `$8F:935E`) acts as the central coordinator between gameplay inventory modifications, passive charm persistence, weapon equip transitions, and player charge stamina initialization:

1. **Dynamic Buff Application & Removal Latches (`$8F:9210` – `$8F:9272`)**:
   - **Buff Latch Register `$7E:243D`**:
     - When loaded with a buff index ($\ge 0$), queries byte offset table `tbl_CCBBB0,X` and bitmask table `tbl_CCBBD8,X`.
     - Atomically ORs the bitmask into the targeted persistence byte (`$7E:2261`..`$7E:2263`).
     - Resets latch `$7E:243D = 0xFFFF`.
     - Rebuilds party stats via `character_stat_recalculation_armor` (`$8F:8398`) and companion stats via `$8F:857D`.
   - **Debuff / Removal Latch Register `$7E:243F`**:
     - When loaded with a buff index ($\ge 0$), queries the same tables.
     - Inverts the bitmask (`EOR #$FFFF`) and clears the bit in persistence RAM.
     - Resets latch `$7E:243F = 0xFFFF`.
     - Cascades stat recalculations across Boy and Dog.

2. **Weapon Equipping & Bitfield Synchronization (`$8F:9273` – `$8F:92EE`)**:
   - Inspects weapon equip request register `$7E:2441`:
     - **Un-equip Request ($< 0$)**: Loops over 13 weapon categories, clearing equipped bits in `$7E:22DA` and `$7E:22DB` using ROM tables `tbl_C459A4` and `tbl_C459C0`. Sets transition flags `$7E:23BF = 1` and `$7E:0ABA = 0`.
     - **Equip Weapon Request ($> 0$)**: Configures weapon animation state timers (`$7E:1434`, `$7E:145D`, `$7E:145E`), updates persistence bitmask in `$7E:22DA`/`$7E:22DB`, and assigns active weapon ID to `$7E:0ABA` and `$7E:235F`.
   - Zeroes request register `$7E:2441 = 0`.

3. **Stamina Priming & Sprite Slice Dispatch (`$8F:92EF` – `$8F:935E`)**:
   - If a weapon transition occurred (`$7E:23BF != 0`):
     - Populates weapon base might and parameters into `$7E:0A58`..`$7E:0A6C`:
       - Base attack: `$7E:0A58 = 0x3EFE`
       - Charged attack: `$7E:0A5A = 0x3F0E`
       - Special proc: `$7E:0A5C = 0x3F1E`
     - Primes default full charge stamina `$0400` (`100.0%`) into both Boy `$7E:4EB7` and Dog `$7E:4F65`.
     - Clears charging locks in status registers `$7E:4E9B` and `$7E:4F49` (`TRB #$0800`).
     - Configures weapon graphic descriptor `$7E:0A2F = 0xAD0B` and triggers dynamic sprite slice assembly via `func_D0CF3A` (`$90:CF3A`).

---

## 2. 65816 Disassembly Analysis

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8F9210](soe://rom/code/8F9210?asm=1&c=0)


---

## 3. Clean C Reconstructed Implementation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8F/8F9210_weapon_equip_buffs.c`](../../../reconstructed-c/8F/8F9210_weapon_equip_buffs.c).
> [View in VFS: soe://rom/code/8F9210](soe://rom/code/8F9210?c=1&asm=0)


---

## 4. Architectural Invariants & Memory Anchors

- **Atomic Latch Inter-Process Communication**:
  - Script opcodes and ring menu actions trigger buff alterations and weapon swaps simply by writing indices into latches `$7E:243D`, `$7E:243F`, and `$7E:2441`.
  - The routine processes requests on the subsequent frame tick, resetting latches to `-1` or `0` to signal completion.
- **Weapon Charge Initialization**:
  - Whenever a new weapon is drawn or swapped, the stamina meter instantly resets to full charge (`1024 = 0x0400 = 100.0%`), preventing the player from being penalized with 0% charge upon equipping a new weapon during combat.
- **Persistence Table Mapping**:
  - Tables `tbl_C459A4` and `tbl_C459C0` bridge weapon IDs to persistent SRAM save bitfields in `$7E:22DA` and `$7E:22DB`, ensuring equipment state survives game saving and reloads.
