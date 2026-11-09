---
addr: 90842F
size: 24
end: 908446
kind: code
category: 🧠
name: anim_op_sprite2
title: Animation command 2C — secondary sprite descriptor (+$09/+$0A) from script stream
confidence: confirmed
evidence: ["disasm: reads byte operand into +$09,Y; reads 16-bit word operand into +$0A,Y; advances script PC <$5D by 3 bytes", "c: G1 passed (tools/c-to-rom/g1.mts): the bound C equals the ROM on 36 entry states sampled from the 2:20 no-input reference and 547 fuzzed ones; snes9x agrees with the interpreter on 36; a mutation is caught"]
see: [docs/entities/animation_script.md]
tags: [entities, animation, sprites]
---
Reads secondary sprite descriptor (usually shadow) 24-bit address from script stream `[<$5D]`: stores bank byte into `+$09,Y` and 16-bit word offset into `+$0A,Y`, advancing script pointer `<$5D` by 3 bytes. Opcode 2C in the animation bytecode interpreter.
