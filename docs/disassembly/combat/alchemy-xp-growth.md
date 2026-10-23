# Alchemy Formula Available Casts, Palette Grey-Out, and Experience Growth ($91:CE38, $90:878C, $91:CD44)

## 1. Subsystem Architecture Overview

The Secret of Evermore Alchemy engine enforces ingredient constraints, inventory counts, and formula level progression through a multi-tiered pipeline:

1. **Available Casts Ratio Calculator (`$91:CE38` – `$91:CE90`)**:
   - Takes formula ID in accumulator `A` (step 2, `0x00`..`0x44` for 35 formulas).
   - Reads 4-byte cost record from `$C4:601F + (formula_id * 2)`:
     - `+$00`: Ingredient 1 ID (`DP $02`)
     - `+$01`: Ingredient 2 ID (`DP $03`)
     - `+$02`: Ingredient 1 Required Quantity (`DP $04`)
     - `+$03`: Ingredient 2 Required Quantity (`DP $05`)
   - Queries player inventory counters at `$7E:22FF + ingredient_id`.
   - Performs hardware 16-bit unsigned division via SNES PPU math registers (`$4204` dividend / `$4206` divisor, reading quotient from `$4214`).
   - Yields individual ingredient cast ratios $Q_1$ and $Q_2$.
   - Evaluates $\min(Q_1, Q_2)$, returning the maximum usable cast count in accumulator `A`.

2. **Ring Menu Icon Animation Opcode `0x56` (`$90:878C` – `$90:87B7`)**:
   - Executes during ring menu rendering for alchemy formula icons.
   - Calls `alchemy_formula_calc_available_casts` (`$91:CE38`).
   - If available casts $< 1$ (accumulator is zero):
     - Loads monochrome greyscale palette pointer `$D0:A8EB` into entity `+0x0C`.
     - Renders the formula icon disabled/greyed-out.
   - If available casts $\ge 1$:
     - Retains full-color active palette.

3. **Formula Cast Experience & Mastery Progression (`$91:CD44` – `$91:CDC6`)**:
   - Executed upon successful formula casting.
   - Queries current formula level $L$ from `$7E:2F98,X` ($0 \dots 9$).
   - Looks up XP gain per cast from ROM table `$C4:5B9C,X`:
     `[10, 5, 4, 3, 2, 2, 1, 1, 1, 1]`.
   - Accumulates XP into `$7E:2F52,X`.
   - If accumulated XP $\ge 100$:
     - Subtracts 100 and increments formula level `$7E:2F98,X` (capped at Level 9).
     - Triggers level-up chime SFX via `$80:B37A`.
     - Displays level-up banner string from table `$C4:5D09,X`.

---

## 2. 65816 Disassembly Analysis

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/91CE38](soe://rom/code/91CE38?asm=1&c=0)


---

## 3. Clean C Reconstructed Implementation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/91/91CE38_alchemy_xp_growth.c`](../../../reconstructed-c/91/91CE38_alchemy_xp_growth.c).
> [View in VFS: soe://rom/code/91CE38](soe://rom/code/91CE38?c=1&asm=0)


---

## 4. Architectural Invariants & Memory Anchors

- **Direct Page Workspace**:
  - `DP $02`: Low byte holds Ingredient 1 ID, high byte holds Ingredient 2 ID.
  - `DP $04`: Low byte holds Ingredient 1 Required Quantity, high byte holds Ingredient 2 Required Quantity.
  - `DP $12`: Temporary register storing quotient $Q_1$ during hardware division of Ingredient 2.
- **Hardware PPU Division Timing**:
  - The SNES CPU requires 16 master cycles between storing divisor `$4206` and reading quotient `$4214`.
  - The routines insert `REP #$20` and 4 `NOP` instructions ($3 + 8 = 11$ cycles) plus addressing latency to guarantee quotient stability before reading.
- **Ring Menu Visual Feedback**:
  - When a player depletes ingredients for an equipped formula, opcode `0x56` automatically intercepts the render pass and assigns palette `$D0:A8EB`.
  - Upon purchasing or collecting required ingredients, subsequent frames re-evaluate `$91:CE38` yielding $> 0$, immediately restoring the vibrant palette without needing ring menu closure.
