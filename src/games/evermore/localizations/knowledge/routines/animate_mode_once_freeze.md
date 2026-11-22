---
addr: 8CE115
end: 8CE11C
size: 8
kind: code
category: 🧠
name: animate_mode_once_freeze
title: animate() mode 2 (ONCE_FREEZE): entity +$12 bit $0200
confidence: confirmed
tags: [script-vm, animation]
evidence: ["rom: `09 00 02` ora #$0200, `99 12 00` sta $0012,y, `80 1c` bra $E139 (A holds +$12 with bits $0300 cleared)", "rom: target of mode 2 in SCRIPT_ANIMATE_MODE_TARGETS ($8C:E100)"]
see: ["routines/SCRIPT_ANIMATE_MODE_TARGETS.md", "routines/animate_id_to_record.md"]
---
Sets bit `$0200` of entity `+$12`, then starts the animation. ONCE_FREEZE in the compiler.
