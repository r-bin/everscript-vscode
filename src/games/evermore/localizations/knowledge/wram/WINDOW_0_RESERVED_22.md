---
addr: $7E:036F
size: 2
kind: var
name: WINDOW_0_RESERVED_22
title: Reserved field / padding in dialogue window descriptor 0
lifetime: room
confidence: confirmed
tags: [ui, dialogue, window]
evidence: ["disasm: WindowLayoutDescriptor struct fields are spaced at 2-byte stride from $7E:034D; offset +$22 sits between WINDOW_0_ANIM_TIMER ($7E:036D) and WINDOW_0_CHOICE_COUNT ($7E:0371)", "cdl: 0 hits across recorded gameplay sessions for $7E:036F..$7E:0370"]
see: [knowledge/wram/WINDOW_0_ANIM_TIMER.md, knowledge/wram/WINDOW_0_CHOICE_COUNT.md]
---
Reserved 2-byte field at offset `+$22` in dialogue window 0 layout descriptor (`$7E:034D`..`$7E:0378`, 44 bytes). Untouched during normal gameplay, acting as structural alignment padding before the multi-choice fields.
