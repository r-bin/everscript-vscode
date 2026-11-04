---
addr: 8F9F05
size: 62
end: 8F9F42
kind: code
category: 🧠
name: companion_metatile_raycast_line_stepper
title: Trace straight-line raycast through metatile grid verifying obstacle clearance
confidence: confirmed
tags: [entities, companion, raycast, collision, bresenham]
evidence: ["disasm: multiplies Y coord by width using $4202/$4216, checks metatile attrs in $7F:0004, extracts collision geometry bits 3..0, and evaluates slope tables $8F:A3F8/$8F:A418 across jump table $8F:A3D8"]
see: [docs/disassembly/entities/companion-steering.md, routines/companion_waypoint_raycast_probe.md, routines/particle_emitter_check_priority_and_enqueue.md]
---
Iterates a line of metatiles between two grid coordinates to verify line-of-sight path traversal:
- Multiplies coordinates using SNES hardware multiplier `$4202` / `$4216`.
- Extracts 4-bit geometry bits from metatile collision words in `$7F:0004`.
- Evaluates impassable walls and directional ramp barriers against tables `$8F:A3F8` and `$8F:A418`.
- Returns Carry Set if the line reaches the target unobstructed; Carry Clear if blocked.
- In: A low = direction, an even index 0..$E into the handler table `$8F:A3D8` (0 up, 2 up-right, 4 right, 6 down-right, 8 down, A down-left, C left, E up-left); A high = steps to walk. No steps: returns at once with C set. The direction and steps live on the stack as `$03,s` and `$01,s`; the loop is at `$9F43`.
- Keeps the cell in `$66`/`$67`, plane in `$68`, the cell's offset in `$56` (from `$66`, `$67` and the row width `$08EE` through the hardware multiplier), the tile class in `$52`. `$08` gets the way the step went: 0 straight up, 1 and 7 past a corner, 2, 8, 9 right, 3, 5 and 4 for down, 6, A, B left.
- Three handler shapes, mirrored at fixed offsets: `$9F49`/`$A022` up and down (straight, or past a corner on either side), `$A0FB`/`$A162` right and left (one cell, three ways in), `$A1C9`/`$A243`/`$A2BD`/`$A337` diagonals (both cells beside it must pass). Tables by tile class: `$A3F8` ways out, `$A408` and `$A418` ways in, `$A428`, `$A438`, `$A448` the three cells of a diagonal.
- On replay 01 (attract demo) it is 19.95 % of all instructions, 29.37 % with the `eval_tile_collision` and `update_entity_plane` calls it makes (98 % and 99 % of all calls to them); 43,740 calls.
- C: `reconstructed-c/8F/8F9F05_companion_metatile_raycast_line_stepper.c`, G1-rated, bound in the recomp a step at a time.
Full disassembly and clean C reconstruction: `docs/disassembly/entities/companion-steering.md`.
