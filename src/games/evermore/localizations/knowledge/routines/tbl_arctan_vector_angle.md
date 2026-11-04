---
addr: 808b23
end: 808B65
size: 67
kind: table
name: tbl_arctan_vector_angle
title: 2D vector arctangent angle lookup table
confidence: confirmed
tags: [math, trig, angle, table, physics]
evidence: ["read by: math_vector_2d_angle_and_distance_calc (80:AEE4, 80:AED6 via and.l data_C08B25-$400000,x) 244 times during gameplay (out/recomp/asar/banks/bank_C0.asm:6180)"]
see: [src/games/evermore/localizations/knowledge/rom/8088a3.md]
---
Monotonic 2D vector arctangent angle conversion table:
- Contains 67 bytes mapping division ratio indices (`$4214` quotient of delta_y / delta_x) to 2D angular direction headings ($0..$20).
- Read by `math_vector_2d_angle_and_distance_calc` to resolve actor heading angles, companion pursuit angles, projectile ballistic vectors, and collision rebound directions.
