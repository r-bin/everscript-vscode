---
addr: 80DE6D
end: 80DE95
size: 41
kind: code
category: 🧠
name: screen_fade_in_with_palette_update_sync
title: Synchronous screen fade-in loop with dynamic palette update callback
confidence: confirmed
tags: [ppu, screen, brightness, palette, fade, vblank]
evidence: ["disasm: STZ $0B7F; STZ $0106; loop: JSL $80:858C; JSR $D22D; LDA $0106; AND #$0080; ORA $0B7F; STA $0106; INC $0B7F; CMP #$0010; BNE loop; RTS at $80:DE6D..$80:DE95"]
see: [knowledge/wram/JOYPAD1_TRIGGERED.md, knowledge/wram/AUDIO_FADE_COUNTER.md, routines/wait_for_nmi.md, routines/screen_fade_in_from_black_sync.md]
---
Increments screen brightness from black up to 15 while executing dynamic palette color calculation callback `JSR $D22D` on each frame, allowing continuous palette shading adjustments during scene fade-in.
