---
addr: 8F9DBD
size: 140
kind: code
category: 🧠
name: entity_cardinal_facing_direction_resolve
title: Resolves cardinal and diagonal facing direction codes from signed X and Y displacement vectors
confidence: guess
tags: [unverified, rea-partial-read]
evidence: ["disasm: only the first ~20 instructions plus caller/callee names of the REA dossier were read (v0.387.7-12 batch); the purpose is inferred from those, not verified"]
---
Low confidence — Resolves cardinal and diagonal facing direction codes from signed X and Y displacement vectors.

> Inferred from a partial read of the routine; names, purposes and variable roles below are hypotheses until the whole body is traced or tested.

Determines which direction an entity should face when pursuing or tracking a target.
The routine compares signed delta-X (`$1A,Y`) and delta-Y (`$1C,Y`).

It evaluates quadrant and relative slope magnitudes, resolving an 8-way directional facing code (Up, Down, Left, Right, and Diagonals), and writes the resulting direction index into entity attribute `$22,Y` to select the corresponding animation walk/idle cycle.

## Callers
- `$8F:9C24` (`FUN_8f9c24`)

## Callees
- None

## Variables and memory (hypotheses)
- `$1A,Y` (Target relative delta-X displacement)
- `$1C,Y` (Target relative delta-Y displacement)
- `$22,Y` (Entity resolved facing direction code)
