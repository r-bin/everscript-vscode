---
addr: 90877D
size: 13
end: 908789
kind: code
category: 🧠
name: anim_op_loop
title: Animation command 2D loop — restore restart point +$03 into PC +$00 and DP $5D
confidence: confirmed
evidence: ["disasm: restores loop PC from +$03,Y into current script address +$00,Y and DP <$5D", "c: G1 passed (tools/c-to-rom/g1.mts): the bound C equals the ROM on 28 entry states sampled from the 2:20 no-input reference and 442 fuzzed ones; snes9x agrees with the interpreter on 28; a mutation is caught"]
see: [docs/entities/animation_script.md]
tags: [entities, animation, control-flow]
---
Animation command 2D loop: jumps to the animation restart point stored in `+$03,Y` by copying it into `+$00,Y` and DP `<$5D`. Where every animation cycle ends.
