---
addr: 7E158E
size: 2
kind: var
name: HDMA_WINDOW_ACTIVE_BUFFER_PTR
title: Active double-buffer base pointer for HDMA window coordinates
lifetime: frame
confidence: confirmed
tags: [window, hdma, spotlight, ppu]
evidence: ["disasm: func_91C899 toggles $158E via EOR $158C between $6869 (Buffer A) and $6A7D (Buffer B), and sets end boundary $1590 = $158E + $0200", "disasm: func_91C7F5 initializes $158E = $6869 and $158C = $6869 ^ $6A7D"]
see: [knowledge/wram/6869.md, knowledge/wram/6a7d.md]
---
16-bit WRAM address pointer tracking the active scanline buffer feeding HDMA Window 1 masking:
- Alternates between `HDMA_WINDOW_MASK_BUFFER_A` (`$7E:6869`) and `HDMA_WINDOW_MASK_BUFFER_B` (`$7E:6A7D`) via XOR mask `$158C` (`$0214`).
- Maintained by `func_91C899` to ensure tear-free double-buffered updates of circular spotlight and screen wipe boundaries.
