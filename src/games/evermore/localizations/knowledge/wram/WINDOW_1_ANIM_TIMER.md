---
addr: $7E:0399
size: 2
kind: var
name: WINDOW_1_ANIM_TIMER
title: Frame countdown timer for window opening / closing animation step for secondary window 1
lifetime: room
confidence: confirmed
tags: [ui, dialogue, window]
evidence: ["disasm: WindowLayoutDescriptor offset +$20 holds window opening/closing animation timer; Y = $0379 for window 1", "cdl: 16-bit word RW accessed during window animation transitions"]
see: [knowledge/wram/WINDOW_0_ANIM_TIMER.md, knowledge/wram/WINDOW_1_CHOICE_COUNT.md]
---
Frame countdown timer for window opening or closing animation transitions for secondary dialogue window 1 (`$7E:0379`..`$7E:03A4`, 44 bytes). Corresponds to offset `+$20` within the window layout descriptor, mirroring `WINDOW_0_ANIM_TIMER` (`$7E:036D`).
