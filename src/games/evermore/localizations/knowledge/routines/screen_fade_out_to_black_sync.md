---
addr: 80DD72
end: 80DD92
size: 33
kind: code
category: 🧠
name: screen_fade_out_to_black_sync
title: Synchronous frame-by-frame PPU screen brightness fade-out loop to black
confidence: confirmed
tags: [ppu, screen, brightness, fade, vblank, mode7]
evidence: ["disasm: LDA $0106; AND #$000F; BEQ exit; STA $0B7F; loop: JSL $80:858C; LDA $0106; AND #$0080; ORA $0B7F; STA $0106; DEC $0B7F; BNE loop; RTS at $80:DD72..$80:DD92"]
see: [knowledge/wram/JOYPAD1_TRIGGERED.md, knowledge/wram/AUDIO_FADE_COUNTER.md, routines/wait_for_nmi.md, routines/fade_audio_and_video_to_black_sync.md]
---
Decrements screen brightness in shadow register `$7E:0106` frame-by-frame from its current level down to 0, synchronizing on each step with VBlank via `wait_for_nmi` (`$80:858C`). Preserves forced-blanking bit 7 while updating the active brightness counter `$7E:0B7F`.
