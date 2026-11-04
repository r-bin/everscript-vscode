---
addr: 808523
end: 808551
size: 47
kind: code
name: snes_configure_vtimer_irq_and_wait_nmi
title: Configure PPU V-Timer IRQ position and synchronize with vertical blank
confidence: confirmed
tags: [hardware, irq, vtimer, ppu, nmi]
evidence: ["disasm: PHP / SEI / STA $012D / STX $012B / TYA / AND #$00FF / STA $010A / STA $4209 / TYA / XBA / AND #$00FF / STA $0108 / STA $4207 / JSL $80858C / SEP #$20 / LDA #$B1 / STA $4200 / STA $0E6B / REP #$20 / PLP / RTL (out/recomp/asar/rom.bin:0x008523)"]
see: [src/games/evermore/localizations/knowledge/routines/snes_set_timer_irq_scanline_and_vector.md, src/games/evermore/localizations/knowledge/routines/wait_for_nmi.md]
---
PPU Scanline Timer IRQ and synchronization setup:
- Saves processor flags and disables interrupts (`PHP; SEI`).
- Stores custom IRQ vector pointers in `$012D` and `$012B`.
- Sets HTIME (`$4207`) and VTIME (`$4209`) hardware PPU raster interrupt trigger positions from Accumulator and Index register inputs.
- Calls `wait_for_nmi` (`JSL $80:858C`) to synchronize execution with the start of vertical blanking.
- Configures hardware register `$4200` and its mirror `$7E:0E6B` to `$B1` (enabling NMI, V-Timer IRQ, and joypad auto-read).
- Restores processor status and returns via `RTL`.
