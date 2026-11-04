---
addr: $7E:039B
size: 2
kind: var
name: WINDOW_1_RESERVED_22
title: Reserved field / padding in secondary dialogue window descriptor 1
lifetime: room
confidence: confirmed
tags: [ui, dialogue, window]
evidence: ["disasm: WindowLayoutDescriptor struct fields are spaced at 2-byte stride from $7E:0379; offset +$22 sits between WINDOW_1_ANIM_TIMER ($7E:0399) and WINDOW_1_CHOICE_COUNT ($7E:039D)", "cdl: 0 hits across recorded gameplay sessions for $7E:039B..$7E:039C"]
see: [knowledge/wram/WINDOW_0_RESERVED_22.md, knowledge/wram/WINDOW_1_CHOICE_COUNT.md]
---
Reserved 2-byte field at offset `+$22` in secondary dialogue window 1 layout descriptor (`$7E:0379`..`$7E:03A4`, 44 bytes). Structural alignment padding mirroring `WINDOW_0_RESERVED_22` (`$7E:036F`).
