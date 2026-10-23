# Alchemy Formula Inventory & Ingredient Consumption Math ($91:D800, $C4:601F, $7E:22FF)

> **Subsystem**: Alchemy Formula Engine & Inventory Consumption  
> **ROM Addresses**: `$91:D800` (`alchemy_deduct_ingredients_and_award_xp`), `$C4:601F` (`ALCHEMY_COST_DATA`), `$C4:5B9C` (`XP_GAIN_PER_CAST`), `$C4:5BA5` (`LEVEL_MULTIPLIERS`)  
> **Clean C Module**: `combat/alchemy-ingredients.c`  
> **Confidence**: Confirmed

---

## 1. Architectural Role

Secret of Evermore implements an alchemy system consisting of 35 distinct formulas. Unlike typical MP-based magic systems, spells require specific alchemical reagents from an inventory of 22 ingredient types:
- **Ingredient Inventory (`$7E:22FF` – `$7E:2314`)**:
  - 22 contiguous bytes in WRAM: Wax (`$22FF`), Water (`$2300`), Vinegar (`$2301`), Roots (`$2302`), Oil (`$2303`), Mushroom (`$2304`), Mud Pepper (`$2305`), Meteorite (`$2306`), Mineral (`$2307`), Limestone (`$2308`), Iron (`$2309`), Gunpowder (`$230A`), Grease (`$230B`), Feather (`$230C`), Dry Ice (`$230D`), Crystal (`$230E`), Clay (`$230F`), Brimstone (`$2310`), Bone (`$2311`), Atlas Medallion (`$2312`), Ash (`$2313`), Acorns (`$2314`).
  - Standard items cap at 99. Mud Pepper caps at 1.
- **Cost Table (`$C4:601F`)**:
  - 35 entries $\times$ 4 bytes: `[Ingredient1_ID, Ingredient2_ID, Qty1, Qty2]`.
- **Pre-Cast Validation & Deduction (`$91:D800`)**:
  - Checks whether the player owns $\ge Qty_1$ of $Ing_1$ and $\ge Qty_2$ of $Ing_2$.
  - Deducts quantities immediately upon spell trigger.
  - Increments formula usage stat counter at `$7E:2FDE + X`.
  - Awards formula experience (`$7E:2F52 + X`) based on the spell's current level using table `$C4:5B9C` (`[10, 5, 4, 3, 2, 2, 1, 1, 1, 1]` for Lv0..Lv9).
  - Levels up formula when experience reaches 100 XP (max Level 9:99).

---

## 2. Disassembly Analysis

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/91D800](soe://rom/code/91D800?asm=1&c=0)


---

## 3. Clean C Implementation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/91/91D800_alchemy_ingredients.c`](../../../reconstructed-c/91/91D800_alchemy_ingredients.c).
> [View in VFS: soe://rom/code/91D800](soe://rom/code/91D800?c=1&asm=0)

