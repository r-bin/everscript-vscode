---
addr: 7E156A
end: 7E156B
kind: var
name: BARRIER_WINDOW_CENTER_X
title: Force field barrier circular spotlight window center screen X coordinate
lifetime: frame
confidence: confirmed
tags: [render, window, hdma, ppu, barrier]
evidence: ["rom-asm: $91:C773 LDA !>$7E23AD; STA !$156A copies barrier world X into window center X", "rom-asm: used by func_91C899 to compute PPU Window 1 left/right scanline bounds"]
see: [docs/disassembly/engine-core/wram-map.md, knowledge/wram/156c.md, knowledge/wram/157e.md]
---
16-bit integer defining the horizontal center coordinate of the protective force field or spotlight circle:
- Set from `$7E:23AD` (`BARRIER_CENTER_X`) by `func_91C73F`.
- Consumed by `func_91C899` to calculate the horizontal aperture bounds (left and right edges) written into the HDMA Window 1 scanline coordinate table at `$7E:6869` / `$7E:6A7D`.
