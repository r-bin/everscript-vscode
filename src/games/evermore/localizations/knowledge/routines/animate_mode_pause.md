---
addr: 8CE125
end: 8CE12F
size: 11
kind: code
category: 🧠
name: animate_mode_pause
title: animate() mode 10 (PAUSE): entity +$10 bit $0001
confidence: confirmed
tags: [script-vm, animation]
evidence: ["rom: `b9 10 00` lda $0010,y, `09 01 00` ora #$0001, `99 10 00` sta $0010,y, `80 09` bra $E139", "rom: target of mode 10 in SCRIPT_ANIMATE_MODE_TARGETS ($8C:E100)"]
see: ["routines/SCRIPT_ANIMATE_MODE_TARGETS.md", "routines/animate_id_to_record.md"]
---
Sets bit `$0001` (hidden and paused) of entity `+$10`, which the common path had just cleared, then starts the animation. PAUSE in the compiler.
