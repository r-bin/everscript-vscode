---
addr: 8CE130
end: 8CE138
size: 9
kind: code
category: 🧠
name: animate_mode_freeze
title: animate() mode 6 (FREEZE): entity +$10 bit $2000
confidence: confirmed
tags: [script-vm, animation]
evidence: ["rom: `b9 10 00` lda $0010,y, `09 00 20` ora #$2000, `99 10 00` sta $0010,y, falls into $E139", "rom: target of mode 6 in SCRIPT_ANIMATE_MODE_TARGETS ($8C:E100)"]
see: ["routines/SCRIPT_ANIMATE_MODE_TARGETS.md", "routines/animate_id_to_record.md"]
---
Sets bit `$2000` of entity `+$10` (hides after a fall: gravity turns it into `$0001`), then falls into the animation start. FREEZE in the compiler.
