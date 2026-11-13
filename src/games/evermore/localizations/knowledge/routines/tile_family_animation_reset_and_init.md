---
addr: 90CC1A
size: 79
end: 90CC68
kind: code
category: 🧠
name: tile_family_animation_reset_and_init
title: Resets tile family animation offsets and initializes sprite palette channels
confidence: verified
tags: [palettes, animation, tile-families, sprites, reconstructed-c, g1-pass]
evidence: "[\"disasm: sets Data Bank $7E; zeroes 8 tile family animation offsets in $7E:62A5..$7E:6385; clears $1432 and cycle step pointers $1278..$1282; initializes animation channel 12 ($0A2F) and channel 14 ($0A79) by calling load_sprite_palette ($90:CF3A)\", \"trace: executed on room entry and script MAP_PALETTE reload\"]; G1 pass (9/9 reference states, 0/0 fuzzed states, mutation caught)"
see: [docs/disassembly/maps/palette-swap.md, docs/disassembly/maps/palette-families.md, routines/cgram_dma_commit_15_palettes.md, routines/load_sprite_palette.md]
---
Zeroes the 8 background tile family animation offsets at `$7E:62A5..$7E:6385`,
clears animation frame hold timer `$7E:1432`, and initializes party sprite palette
animation channels 12 (`$0A2F`) and 14 (`$0A79`) via `load_sprite_palette` (`$90:CF3A`).
Full disassembly and clean C reconstruction: `docs/disassembly/maps/palette-swap.md`.
