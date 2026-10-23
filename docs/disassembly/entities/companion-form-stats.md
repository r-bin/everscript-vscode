# Companion (Dog) Level Stat Scaling, Collar Armor & Toaster Form Transformation ($8F:857D – $8F:8688)

## 1. Subsystem Architecture Overview

The companion (Dog) progression and combat parameter engine in Bank `$8F` (`$8F:857D` – `$8F:8688`) recalculates all companion offensive, defensive, and vitality statistics whenever the companion levels up, equips new collars, acquires passive alchemy charms, or transforms across historical epochs:

1. **Level-Based Stat Curve Indexing (`$8F:857D` – `$8F:8640`)**:
   - Reads companion level from `$7E:0A9A` ($0 \dots 98$), shifts left by 1 to index word tables in Bank `$8C`:
     - **Max HP (`$7E:0A7F`)**: Queries base table `$8C:9515,X`. If Chocobo Egg charm (`$7E:2261 & 0x0040`) is held, queries amplified table `$8C:951F,X`. Clamps Max HP to 999 (`0x03E7`) and updates current HP clamp `$7E:4F61`.
     - **Magic Defense (`$7E:0A89`)**: Queries table `$8C:96D1,X` (amplified by charm `$7E:2263 & 0x0001`), and adds accessory gear bonus `$7E:4FD7`.
     - **Physical Defense (`$7E:0A8B`)**: Queries table `$8C:95F3,X` (amplified by Armor Polish charm `$7E:2262 & 0x0080`), and adds accessory gear bonus `$7E:4FD9`.
     - **Evade (`$7E:0A8D`)**: Queries table `$8C:97AF,X` (amplified by charm `$7E:2263 & 0x0004`), and adds accessory gear bonus `$7E:4FDF`.
     - **Hit Rate (`$7E:0A91`)**: Queries table `$8C:90BF,X` (amplified by charm `$7E:2262 & 0x0001`) + gear `$7E:4FDD`, clamped to 99 max (`0x0063`).
     - **Attack Power (`$7E:0A8F`)**: Queries table `$8C:8FE1,X` (amplified by Atlas charm `$7E:2263 & 0x0002`) + gear `$7E:4FDB`, clamped to 99 max (`0x0063`).

2. **Equipped Collar Defense Addition (`$8F:8640` – `$8F:8664`)**:
   - Reads equipped collar item ID from `$7E:0ABE`.
   - If a collar is equipped ($> 0$), queries ROM armor defense table at `$C4:0000 + (collar_id * 2)`.
   - Checks charm modifier `$7E:2261 & 0x0020`; if active, applies $+25\%$ bonus ($D + \lfloor D / 4 \rfloor$).
   - Sums collar defense into the companion's effective defense `$7E:0A8B`.

3. **Toaster Dog Epoch Form Transformation (`$8F:8664` – `$8F:8688`)**:
   - Checks active companion form register `$7E:2363`.
   - Form `0x000C` corresponds to the secret **Toaster Dog form** in Omnitopia:
     - Directly adds $+80$ Magic Defense (`+$0050` into `$7E:0A89`).
     - Directly adds $+250$ Physical Defense (`+$00FA` into `$7E:0A8B`).
   - Restores Data Bank and returns.

---

## 2. 65816 Disassembly Analysis

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8F857D](soe://rom/code/8F857D?asm=1&c=0)


---

## 3. Clean C Reconstructed Implementation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8F/8F857D_companion_form_stats.c`](../../../reconstructed-c/8F/8F857D_companion_form_stats.c).
> [View in VFS: soe://rom/code/8F857D](soe://rom/code/8F857D?c=1&asm=0)


---

## 4. Architectural Invariants & Memory Anchors

- **Toaster Dog Form `0x000C`**:
  - In Omnitopia, entering the secret toaster transformation alters the Dog's appearance to a mechanical toaster and grants a colossal $+80$ Magic Defense and $+250$ Physical Defense, making the companion almost impervious to standard enemy attacks.
- **Charm Integration Matrix**:
  - Permanent charms in `$7E:2261`..`$7E:2263` do not apply flat additions; they swap the entire underlying scaling curve to a higher-growth polynomial curve in Bank `$8C`, ensuring proportional scaling as level increases.
- **Max HP Clamping**:
  - The routine strictly enforces the 999 HP engine limit (`$7E:0A7F`) and clamps active current HP (`$7E:4F61`) if an equipment swap or charm removal drops max HP below current HP.
