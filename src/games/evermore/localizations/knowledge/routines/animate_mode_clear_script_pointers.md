---
addr: 8CE10C
end: 8CE114
size: 9
kind: code
category: 🧠
name: animate_mode_clear_script_pointers
title: animate() mode 8: clear the entity's resume and restart pointers
confidence: confirmed
tags: [script-vm, animation]
evidence: ["rom: `7b` tdc, `99 03 00` sta $0003,y, `99 01 00` sta $0001,y, `80 24` bra $E139", "rom: target of mode 8 in SCRIPT_ANIMATE_MODE_TARGETS ($8C:E100)"]
see: ["routines/SCRIPT_ANIMATE_MODE_TARGETS.md", "routines/animate_id_to_record.md"]
---
Clears the words at entity `+$01` and `+$03` (with DP 0: the high byte and bank of the resume pointer `+$00..+$02`, and the restart point `+$03..+$04`), then starts the animation. The compiler has no name for mode 8. Vanilla uses it twice, both on the skeleton ship in the Desert of Doom (room steps 6 and 7).
