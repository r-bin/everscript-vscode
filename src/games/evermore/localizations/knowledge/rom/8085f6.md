---
addr: 8085F6
end: 8085F9
size: 4
kind: code
category: 🧠
name: screen_blank_display
title: Force blank PPU screen display (zero brightness) in shadow register
confidence: confirmed
tags: [ppu, screen, brightness, blanking, graphics]
evidence: ["disasm: STZ $0106; RTL at $80:85F6..$80:85F9; zeroes screen brightness in shadow register; called via JSL from $8E:CE99 ($CE:98B2)"]
see: [knowledge/wram/JOYPAD1_TRIGGERED.md, rom/8085ed.md]
---
Immediately blacks out the display by zeroing PPU brightness register shadow `$7E:0106` via `STZ $0106` and returning via `RTL`. Invoked by cutscene and dialogue transitions prior to bulk VRAM/CGRAM DMA uploads.
