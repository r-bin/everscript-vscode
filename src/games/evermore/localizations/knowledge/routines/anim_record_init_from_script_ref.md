---
addr: 90817B
end: 908199
size: 31
kind: code
category: 🧠
name: anim_record_init_from_script_ref
title: Initialise an animation record from a 3-byte script reference ($90:817B)
confidence: verified
tags: [animation, entity, reconstructed-c, g1-pass]
evidence: ["reconstructed-c/90/90817B_anim_record_init_from_script_ref.c passes Gate G1 (v0.399.39, fixed to ABSI16/ABSI8 for DB+1 carry at y=$FFFF: 33/33 reference states, 525/525 fuzzed, mutation caught)", "disasm: full body read (12 instructions): reads word + bank byte at $C4:0000+X; writes the word to +$00 and +$03, the bank to +$02, stores D to +$0E, sets +$05 = 1 (record in Y)", "disasm: callers include the animation VM loop $90:80CE and the entity reset paths $8F:B3D4 / $8F:C40F"]
see: ["src/games/evermore/localizations/knowledge/routines/anim_vm_tick.md"]
---
X selects a 3-byte reference (16-bit offset plus bank byte) in the table at `$C4:0000`. The routine stores it into the animation record Y: the word goes to `+$00` (script pointer) and `+$03` (restart pointer), the bank to `+$02`, then `+$0E` is set to direct page D and `+$05` (timer) is set to 1. The animation VM (`routines/anim_vm_tick.md`) then starts reading the script from that pointer.
