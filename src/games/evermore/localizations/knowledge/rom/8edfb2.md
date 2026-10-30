---
addr: 8EDFB2
size: 217
kind: code
category: 🧠
name: entity_linear_interpolation_fixed_point_multiply
title: Computes fixed-point linear interpolation between entity coordinate endpoints via hardware multiplication
confidence: guess
tags: [unverified, rea-partial-read]
evidence: ["disasm: only the first ~20 instructions plus caller/callee names of the REA dossier were read (v0.387.7-12 batch); the purpose is inferred from those, not verified"]
---
Low confidence — Computes fixed-point linear interpolation between entity coordinate endpoints via hardware multiplication.

> Inferred from a partial read of the routine; names, purposes and variable roles below are hypotheses until the whole body is traced or tested.

Mathematical utility for smooth entity position interpolation (LERP) during cutscenes and scripted transitions.
The routine computes displacement `$10,X` by subtracting initial position `$06,X` from destination `$0C,X`.

It multiplies displacement with interpolation progress ratio `$00,X` using SNES hardware multiplier `$4202`, outputting the interpolated coordinate step into entity record variable `$0E,X`.

## Callers
- `$91:9823` (`func_919823`)

## Callees
- None

## Variables and memory (hypotheses)
- `$06,X` (Starting coordinate of interpolation path)
- `$0C,X` (Target coordinate of interpolation path)
- `$00,X` (Progress step multiplier)
- `$10,X` (Displacement delta vector)
- `$0E,X` (Resultant interpolated intermediate position)
- `$4202` (Hardware multiplier register)
