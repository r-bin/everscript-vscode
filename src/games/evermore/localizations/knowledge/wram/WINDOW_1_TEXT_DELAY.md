---
addr: $7E:037F
size: 2
kind: var
name: WINDOW_1_TEXT_DELAY
title: Text display speed / delay setting for secondary window 1
lifetime: room
confidence: confirmed
tags: [ui, dialogue, window]
evidence: ["disasm: WindowLayoutDescriptor offset +$06 holds text display speed (frames between characters); Y = $0379 for window 1", "disasm: $8C:BCB5 sta.w $037F initializes text delay for secondary choice box"]
see: [knowledge/wram/WINDOW_0_TEXT_DELAY.md, knowledge/wram/WINDOW_1_BORDER_STYLE.md]
---
Text display speed and delay setting (frames between characters) for secondary dialogue window 1 (`$7E:0379`..`$7E:03A4`, 44 bytes). Corresponds to offset `+$06` within the window layout descriptor, mirroring `WINDOW_0_TEXT_DELAY` (`$7E:0353`).
