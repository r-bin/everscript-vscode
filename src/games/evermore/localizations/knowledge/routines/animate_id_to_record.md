---
addr: 8CE139
size: 29
end: 8CE155
kind: code
category: 🧠
name: animate_id_to_record
title: animate()'s id → animation record (global id table, or a field of the character's ROM record)
confidence: confirmed
tags: [entities, animation, scripts, script-vm]
evidence: ["rom: $8C:E139 `fa` plx (the id), `30 06` bmi, `bf 92 3c c4` lda $C43C92,x (the global id table), `80 0d` bra; else `8a` txa, `29 ff 7f` and #$7FFF, `18 79 60 00` clc / adc $0060,y (the entity's character record offset), `aa` tax, `bf 32 00 8e` lda $8E0032,x; then `22 24 81 ..` jsl $908124", "test: tests/memory/sprites.test.js (Vigor's ANIMATION_ALL.SLASH_1/2 = $8006/$8008 play his attack 0/1 records)", "disasm: the common opcode 0x78 path calls $90:8124, sets carry, and returns at $8C:E155 (vanilla VFS disassembly)"]
see: ["routines/character_records.md", "routines/boy_load_weapon.md", "routines/dog_load_form.md", "routines/script_op_78_animate.md", "routines/SCRIPT_ANIMATE_MODE_TARGETS.md", "docs/disassembly/script-vm/animate.md"]
---
An id below `$8000` is looked up in the global id table at `$C4:3C92`. An id from `$8000` names a
field of the character's own record, `+$32 + (id & $7FFF)` (so `$8006` is attack 0, `+$38`), read
from **ROM** bank `$8E`, not from the Boy's or Dog's WRAM copy: an equipped weapon or Dog form does
not change what such an id plays. Walk-through: `docs/entities/animation_script.md` (the id table).
