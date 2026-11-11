---
addr: 8FDDBB
end: 8FDE97
size: 221
kind: code
category: 🧠
name: dog_foraging_ingredient_node_spawn_dice_roll
title: Spawner: create enemies from spawn records just outside the screen
confidence: likely
tags: [unverified, rea-partial-read, widescreen, widescreen.spawn, rng]
evidence: ["disasm: only the first ~20 instructions plus caller/callee names of the REA dossier were read (v0.387.7-12 batch); the purpose is inferred from those, not verified"]
---
Runs every field frame (from `$8F:AFBC`). Visits 10 of the 60 spawn records (`$7E:5DC3`, 16 bytes each, cursor `$0EBE`), counts frames into `$6183`/`$6185` for the respawn timers, and spawns from a record whose count `+$0C` is non-zero and whose timer `+$08` ran out, when the awake count `$1070` is below the budget `$1076`, `$1074` is below `$2435`, and the record's point lies 16..48 px outside the screen (inside [−48, 304), not inside [−16, 272), relative to `$59`/`$5B`). The new entity is made by `$90:D39A`-style projectile_spawn_master with the record in `+$8C`. The timer is re-rolled from the hardware multiplier with an RNG byte. Previously believed: dog foraging dice (asm read whole 2026-11-09).

> Inferred from a partial read of the routine; names, purposes and variable roles below are hypotheses until the whole body is traced or tested.

Manages the dog companion\'s ambient sniffing behavior and hidden ingredient node detection.
The routine increments foraging cycle counter `$6185` and checks proximity to hidden alchemy ingredient discovery points (starting at `$5DC3`).

It invokes the pseudo-random number generator (`$80:859B`) to compare against the ingredient node\'s spawn probability. When successful, it triggers the dog\'s alert bark and points towards the discovery location.

## Callers
- `$8F:AFAE` (`FUN_8fafae`)

## Callees
- `$80:859B` (`FUN_80859b`)
- `$8F:B094` (`FUN_8fb094`)

## Variables and memory (hypotheses)
- `$6185` (Dog foraging inspection cycle counter)
- `$6183` (Foraging interval trigger threshold)
- `$5DC3` (Room hidden ingredient node table pointer in WRAM)
- `$0EBE` (Active target discovery node index)
