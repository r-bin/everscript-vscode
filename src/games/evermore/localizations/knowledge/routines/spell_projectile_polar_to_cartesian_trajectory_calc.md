---
addr: 91CBB1
end: 91CC14
size: 100
kind: code
category: 🧠
name: spell_projectile_polar_to_cartesian_trajectory_calc
title: Calculates trajectory step vector and updates projectile coordinates $46/$48
confidence: verified
tags: [projectile, trajectory, math, reconstructed-c, g1-pass]
evidence: ["disasm: $91:CBB1 computes target vector dx ($3E - $46) and dy ($40 - $48), calls math_vector_2d_angle_and_distance_calc ($80:AEAC), checks max(|dx|, |dy|) >= 12, samples RNG ($80:859B), adds jitter to angle, indexes 7-byte stride table at [$2E], and updates coordinates $46/$48", "replay 02 G1 test: 35/35 captured states match ROM with 100% register, flag, and WRAM parity; mutation caught: yes"]
---
Trajectory step vector and coordinate update routine for projectiles.

Calculates directional vector between target coordinates (DP `$3E`/`$40`) and projectile position (DP `$46`/`$48`):
1. Computes signed $\Delta X = \$3E - \$46 \to \text{DP } \$02$ and $\Delta Y = \$40 - \$48 \to \text{DP } \$04$.
2. Invokes `$80:AEAC` (`math_vector_2d_angle_and_distance_calc`) to compute 8-bit heading angle and absolute distances $|\Delta X| \to \text{DP } \$12$ and $|\Delta Y| \to \text{DP } \$14$.
3. Checks $\max(|\Delta X|, |\Delta Y|) \ge 12$:
   - If $< 12$: clears Carry (`CLC`) and returns via `RTL`.
4. If $\ge 12$:
   - Samples RNG (`$80:859B`) with Carry set.
   - Computes jitter: extracts low 7 bits of RNG, divides by 2, subtracts 32 with borrow, and adds to angle with carry.
   - Masks jittered angle to multiple of 8 (`AND #$00F8`).
   - Computes table index: $Y = \text{angle} - (\text{angle} / 8) = 7 \times (\text{angle} / 8)$.
   - Copies previous position to DP `$02`/`$04`.
   - Reads 7-byte table entry through pointer `[$2E]`:
     - Word at $Y + 0 \to \text{DP } \$26$.
     - Word at $Y + 2 \to \text{DP } \$28$.
     - Adds word at $Y + 3$ to projectile X coordinate (DP `$46`).
     - Adds word at $Y + 5$ to projectile Y coordinate (DP `$48`).
   - Sets Carry (`SEC`) and returns via `RTL`.

## Callers
- `$91:CAFE` (`func_91CAFE`)

## Callees
- `$80:AEAC` (`math_vector_2d_angle_and_distance_calc`)
- `$80:859B` (`random_number_generator`)

## Variables and memory
- `$02`, `$04`: Coordinate delta / angle scratch
- `$12`, `$14`: Absolute coordinate distances $|\Delta X|$, $|\Delta Y|$
- `$26`, `$28`: Staged projectile vector descriptor words
- `$2E`: 24-bit pointer to 7-byte trajectory step lookup table
- `$3E`, `$40`: Target X, Y coordinates
- `$46`, `$48`: Projectile current X, Y coordinates
