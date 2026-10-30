---
addr: 80AEAC
size: 369
kind: code
category: 🧠
name: math_vector_2d_angle_and_distance_calc
title: Computes 2D vector distance and angle (0..255) from signed X and Y coordinate displacements
confidence: guess
tags: [unverified, rea-partial-read]
evidence: ["disasm: only the first ~20 instructions plus caller/callee names of the REA dossier were read (v0.387.7-12 batch); the purpose is inferred from those, not verified"]
---
Low confidence — Computes 2D vector distance and angle (0..255) from signed X and Y coordinate displacements.

> Inferred from a partial read of the routine; names, purposes and variable roles below are hypotheses until the whole body is traced or tested.

General mathematical primitive for calculating directional angle and linear distance between two points.
The function takes signed 16-bit delta-X in `$02` and delta-Y in `$04`.

It determines the quadrant, performs octant folding to keep values within 0..45 degrees, computes the ratio of displacements, and uses a lookup table to determine the 8-bit heading angle (0..255, where 0 is East, 64 is South, etc.). It also computes Euclidean distance approximation for projectile speeds and homing trajectory calculations.

## Callers
- `$90:DE11` (`FUN_90de11`)
- `$91:CBB1` (`FUN_91cbb1`)

## Callees
- None

## Variables and memory (hypotheses)
- `$02` (Input signed delta-X displacement)
- `$04` (Input signed delta-Y displacement)
- `$12`, `$14` (Absolute magnitude temporary coordinates)
