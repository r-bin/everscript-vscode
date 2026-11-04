---
addr: $7E:039D
size: 2
kind: var
name: WINDOW_1_CHOICE_COUNT
title: Number of interactive options in choice box for secondary window 1
lifetime: room
confidence: confirmed
tags: [ui, dialogue, window]
evidence: ["disasm: WindowLayoutDescriptor offset +$24 holds choice count in multi-choice selection box; Y = $0379 for window 1", "cdl: 16-bit word RW accessed during choice prompt loops"]
see: [knowledge/wram/WINDOW_0_CHOICE_COUNT.md, knowledge/wram/WINDOW_1_SELECTION_CURSOR.md]
---
Number of interactive options in multiple-choice prompt box for secondary dialogue window 1 (`$7E:0379`..`$7E:03A4`, 44 bytes). Corresponds to offset `+$24` within the window layout descriptor, mirroring `WINDOW_0_CHOICE_COUNT` (`$7E:0371`).
