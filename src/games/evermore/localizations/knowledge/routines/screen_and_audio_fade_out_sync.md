---
addr: 80DE1B
end: 80DE44
size: 42
kind: code
category: 🧠
name: screen_and_audio_fade_out_sync
title: Concurrent screen brightness fade-out and audio attenuation loop
confidence: confirmed
tags: [ppu, audio, fade, screen, attenuation, mode7]
evidence: ["disasm: fades brightness $0106 and dispatches APU attenuation commands via JSL $8C:81FD on each vertical blank ($80:858C) at $80:DE1B..$80:DE44; terminates via RTS"]
see: [knowledge/wram/JOYPAD1_TRIGGERED.md, knowledge/wram/AUDIO_FADE_COUNTER.md, routines/wait_for_nmi.md, routines/apu_command_handshake.md]
---
Simultaneously fades screen brightness down to black while progressively attenuating SPC700 master audio volume. Synchronizes frame-by-frame with vertical blank (`$80:858C`), steps brightness down in `$0106`, and sends attenuation commands via `$8C:81FD`.
