---
addr: 90CE20
end: 90CE77
size: 88
kind: code
category: 🧠
name: oam_dynamic_sprite_palette_slot_release
title: Frees an allocated dynamic sprite palette slot from the 8-palette OAM pool upon entity despawn
confidence: verified
tags: [unverified, rea-partial-read, reconstructed-c, g1-pass]
evidence:
  - "[\"disasm: only the first ~20 instructions plus caller/callee names of the REA dossier were read (v0.387.7-12 batch); the purpose is inferred from those, not verified\"]"
  - "Reconstructed in `reconstructed-c/90/90CE20_oam_dynamic_sprite_palette_slot_release.c` (SOE_BIND); passes Gate G1 differential verification (20/20 reference states, 320/320 fuzzed states, mutation caught: yes, 46 / 546 ROM/C instructions per call)."
---
Low confidence — Frees an allocated dynamic sprite palette slot from the 8-palette OAM pool upon entity despawn.

> Inferred from a partial read of the routine; names, purposes and variable roles below are hypotheses until the whole body is traced or tested.

Palette resource manager deallocation utility.
When an enemy or spell particle despawns, the routine examines its assigned OAM palette index in `$0E9E,X`.

It clears reference count bits in palette usage bitmask `$0EA6`, releasing the hardware palette slot for reuse by newly spawned entities.

## Callers
- `$90:CD5C` (`FUN_90cd5c`)

## Callees
- None

## Variables and memory (hypotheses)
- `$0E9E,X` (Assigned sprite palette slot index)
- `$0EA6` (Active dynamic sprite palette usage bitmask)
