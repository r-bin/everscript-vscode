---
addr: 90DE11
size: 77
end: 90DE5D
kind: code
category: 🎮
name: projectile_trajectory_init_relative_target
title: Initialize projectile homing trajectory relative to target ($90:DE11)
confidence: confirmed
evidence: ["disasm: reads target entity from $0F42; computes delta X (+1A - +14) and delta Y (+1C - +16); scales to 16.16 fixed point (ASL 4); dispatches trajectory math $80:AEAC and $80:B01D"]
see: ["routines/math_vector_2d_angle_and_distance_calc.md","routines/math_fixed_point_sin_cos_multiply.md"]
tags: ["projectile","trajectory","math","physics"]
---
Initializes trajectory and velocity vectors for homing or directed projectiles relative to target entity `$0F42`. Computes coordinate deltas (`+$1A,X - +$14,Y`, `+$1C,X - +$16,Y`), converts positions to 16.16 fixed-point by shifting left 4 bits, and calls trajectory math subroutines `FUN_80aeac` and `FUN_80b01d`.
