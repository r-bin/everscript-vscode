---
addr: 7E157E
end: 7E157F
kind: var
name: BARRIER_WINDOW_EXPANSION_RATE
title: Force field barrier circular window radial expansion step delta
lifetime: frame
confidence: confirmed
tags: [render, window, hdma, ppu, barrier]
evidence: ["rom-asm: $91:C788 STA !$157E latches radial expansion rate from $7E:23B3", "rom-asm: controls per-frame radius growth in HDMA circular window rasterization ($91:C899)"]
see: [docs/disassembly/engine-core/wram-map.md, knowledge/wram/BARRIER_WINDOW_CENTER_X.md]
---
16-bit signed integer controlling the radial growth or shrinkage step delta per frame for the Barrier shield:
- Initialized from `$7E:23B3` (`BARRIER_EXPANSION_RATE`) in `func_91C73F`.
- Added to the active aperture radius accumulator in `func_91C899` each frame until the target shield boundary is reached.
