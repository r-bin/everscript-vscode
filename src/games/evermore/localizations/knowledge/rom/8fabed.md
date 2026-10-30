---
addr: 8FABED
size: 118
kind: code
category: 🧠
name: companion_leash_distance_and_stuck_recovery_tick
title: Monitors dog companion leash distance and triggers recovery teleport if obstructed or separated
confidence: guess
tags: [unverified, rea-partial-read]
evidence: ["disasm: only the first ~20 instructions plus caller/callee names of the REA dossier were read (v0.387.7-12 batch); the purpose is inferred from those, not verified"]
---
Low confidence — Monitors dog companion leash distance and triggers recovery teleport if obstructed or separated.

> Inferred from a partial read of the routine; names, purposes and variable roles below are hypotheses until the whole body is traced or tested.

AI guard routine maintaining companion proximity to the player.
The routine compares the dog\'s world position against the protagonist, calculating Euclidean leash distance.

If the companion remains beyond maximum leash distance or fails to make navigational progress over consecutive frame intervals, it triggers pathing recovery or teleports the dog near the Boy via waypoint anchor init.

## Callers
- Companion AI state machine loops in Bank `$8F`

## Callees
- `$8F:AC24` (`func_8FAC24`)

## Variables and memory (hypotheses)
- `$4E89` (Boy entity base address)
- `$4EAD` (Dog companion entity base address)
- `$1A,X`, `$1C,X` (Entity X and Y world coordinates)
