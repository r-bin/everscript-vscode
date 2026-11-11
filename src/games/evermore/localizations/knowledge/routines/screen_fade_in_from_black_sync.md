---
addr: 80DE45
end: 80DE6C
size: 40
kind: code
category: 🧠
name: screen_fade_in_from_black_sync
title: Synchronous frame-by-frame PPU screen brightness fade-in loop from black
confidence: confirmed
tags: [ppu, screen, brightness, fade, vblank, widescreen, widescreen.fade, mode7]
evidence: ["disasm: STZ $0B7F; STZ $0106; loop: JSL $80:858C; LDA $0106; AND #$0080; ORA $0B7F; STA $0106; INC $0B7F; CMP #$0010; BNE loop; RTS at $80:DE45..$80:DE6C"]
see: [knowledge/wram/JOYPAD1_TRIGGERED.md, knowledge/wram/AUDIO_FADE_COUNTER.md, routines/wait_for_nmi.md, routines/screen_fade_in_with_palette_update_sync.md]
---
Increments screen brightness in shadow register `$7E:0106` frame-by-frame from black (0) up to full brightness (15 / `0x0F`), synchronizing on each step with VBlank via `wait_for_nmi` (`$80:858C`).
