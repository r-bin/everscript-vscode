---
addr: 90CBC8
size: 82
end: 90CC19
kind: code
category: 🧠
name: cgram_dma_commit_15_palettes
title: Commits 480 bytes to CGRAM via DMA Channel 1 and resets palette animation timers
confidence: verified
tags: [palettes, cgram, dma, hardware, reconstructed-c, g1-pass]
evidence:
  - "[\"disasm: sets 8-bit index mode; configures DMA1 source $80:8000, size $01E0 (480 bytes), destination CGDATA $2122 at CGADD $10; triggers MDMAEN $420B with $02; restores 16-bit mode; clears animation timers $128E/$1290, cycle states $1278..$1286, and zeroes 16 words in $13D2..$13F0\", \"trace: executed on room entry and script MAP_PALETTE reload\"]"
  - "Reconstructed in `reconstructed-c/90/90CBC8_cgram_dma_commit_15_palettes.c` (SOE_BIND); passes Gate G1 differential verification (9/9 reference states, 144/144 fuzzed states, mutation caught: yes, 92 / 1505 ROM/C instructions per call)."
see: [docs/disassembly/maps/palette-swap.md, docs/disassembly/maps/palette-families.md, routines/reload_families_when_a_script_changes_map_palett.md, routines/tile_family_animation_reset_and_init.md]
---
Transfers 15 palettes (480 bytes) from `$80:8000` into CGRAM (`$2122`) via DMA Channel 1,
clears all animated palette channel countdown timers and cycle steps,
and zeroes the 16-word channel state buffer at `$7E:13D2..$7E:13F0`.
Full disassembly and clean C reconstruction: `docs/disassembly/maps/palette-swap.md`.
