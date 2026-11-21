---
addr: 8CE11D
end: 8CE124
size: 8
kind: code
category: 🧠
name: animate_mode_loop
title: animate() mode 4 (LOOP): entity +$12 bit $0100
confidence: confirmed
tags: [script-vm, animation]
evidence: ["rom: `09 00 01` ora #$0100, `99 12 00` sta $0012,y, `80 14` bra $E139", "rom: target of mode 4 in SCRIPT_ANIMATE_MODE_TARGETS ($8C:E100)"]
see: ["routines/SCRIPT_ANIMATE_MODE_TARGETS.md", "routines/animate_id_to_record.md"]
---
Sets bit `$0100` of entity `+$12` (the state `end_check` restarts the script in), then starts the animation. LOOP in the compiler.
