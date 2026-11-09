---
addr: 908495
size: 18
end: 9084A6
kind: code
category: 🧠
name: anim_op_clear_stamina
title: Animation command 4E — clear stamina +$2E and closed states bit 9 (+$14)
confidence: confirmed
evidence: ["disasm: resets stamina +$2E,X = 0; clears bit 9 ($0200) in +$14,X via AND #$FDFF", "c: G1 passed (tools/c-to-rom/g1.mts): the bound C equals the ROM on 17 entry states sampled from the 2:20 no-input reference and 272 fuzzed ones; snes9x agrees with the interpreter on 17; a mutation is caught"]
see: [docs/entities/animation_script.md]
tags: [entities, animation]
---
Resets entity stamina `+$2E,X = 0` and clears closed states flag bit 9 (`$0200`) in `+$14,X` (`AND #$FDFF`). Opcode 4E in the animation bytecode interpreter.
