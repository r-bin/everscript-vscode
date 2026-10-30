---
addr: 90DFDF
size: 148
kind: code
category: 🧠
name: math_vector_scale_and_hardware_division
title: Clamps scalar factors and computes signed vector division via SNES hardware division registers
confidence: guess
tags: [unverified, rea-partial-read]
evidence: ["disasm: only the first ~20 instructions plus caller/callee names of the REA dossier were read (v0.387.7-12 batch); the purpose is inferred from those, not verified"]
---
Low confidence — Clamps scalar factors and computes signed vector division via SNES hardware division registers.

> Inferred from a partial read of the routine; names, purposes and variable roles below are hypotheses until the whole body is traced or tested.

Mathematical scaling primitive used in physics, homing trajectories, and camera zoom.
The routine clamps the divisor scale factor between 4 and 1023 (`#$03FF`).

It feeds 16-bit signed displacement `$02` into SNES hardware dividend register `$4204` and divisor `$12` into `$4206`, waiting the requisite hardware cycles before returning the scaled 16-bit quotient in the Accumulator.

## Callers
- `$90:DDCA` (`func_90DDCA`)

## Callees
- None

## Variables and memory (hypotheses)
- `$02` (Input signed 16-bit displacement vector)
- `$12` (Clamped scaling divisor)
- `$4204` (Hardware 16-bit dividend register)
- `$4206` (Hardware 8-bit divisor register)
