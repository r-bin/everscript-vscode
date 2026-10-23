# Equipment Inventory, Defense Calculation & Character Script Spawner ($8E:99D2, $8E:9A86, $8E:A091)

> **Subsystem**: Equipment, Stats & Character Setup Subsystem  
> **ROM Addresses**: `$8E:99D2` (`calc_equipped_armor_defense`), `$8E:9A86` (`init_equipment_screen_slots`), `$8E:A091` (`spawn_character_script_thread`)  
> **Clean C Module**: `ui/equipment-stats.c`  
> **Recomp Symbol**: `func_CE99D2_M0X0`, `func_CE9A86_M0X0`  
> **Confidence**: Confirmed

---

## 1. Architectural Role

Secret of Evermore tracks equipped armors, accessories, and weapons across 4 gear categories for both party members:
- **Equipment Categories**:
  - `0x16`: Collars (Dog) / Helmets (Boy).
  - `0x1A`: Vests & Body Armors.
  - `0x1C`: Arm Bracers & Gauntlets.
  - `0x1E`: Accessories & Rings.
- **Equipped Armor Defense Calculation (`$8E:99D2`)**:
  - Iterates through equipment slots, validating active gear against ROM table bitmasks at `$C4:59A4` and `$C4:59C0`.
  - Accumulates physical armor defense into `$7E:07A4`.
  - Accumulates magic defense (MDef) into `$7E:07A6`.
  - Propagates final defense sums to character stat records: Boy's stats at `$7E:0A26` and Dog's stats at `$7E:0A70` (`$7E:0ABA` defense aggregate).
- **Equipment Screen Initialization (`$8E:9A86`)**:
  - Populates UI slot indices (`$7E:0814 = 0x16`, `$7E:0816 = 0x1A`, `$7E:0818 = 0x1C`, `$7E:081A = 0x1E`) for rendering the status/equip sub-ring.
- **Character Script Spawner (`$8E:A091`)**:
  - Called during cold boot and room transitions (`$8E:E4E2`) to instantiate persistent character script VM threads for Boy and Dog.

---

## 2. Disassembly Analysis

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8E99D2](soe://rom/code/8E99D2?asm=1&c=0)


---

## 3. Clean C Implementation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8E/8E99D2_equipment_stats.c`](../../../reconstructed-c/8E/8E99D2_equipment_stats.c).
> [View in VFS: soe://rom/code/8E99D2](soe://rom/code/8E99D2?c=1&asm=0)

