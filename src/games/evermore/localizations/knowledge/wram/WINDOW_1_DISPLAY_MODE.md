---
addr: $7E:0397
size: 2
kind: var
name: WINDOW_1_DISPLAY_MODE
title: Window display mode flags for secondary window 1
lifetime: room
confidence: confirmed
tags: [ui, dialogue, window]
evidence: ["disasm: WindowLayoutDescriptor offset +$1E holds window rendering style and display mode flags; Y = $0379 for window 1", "disasm: controls transparent/solid box framing and text blitting flags"]
see: [knowledge/wram/WINDOW_0_DISPLAY_MODE.md, knowledge/wram/WINDOW_1_ANIM_TIMER.md]
---
Window display mode flags for secondary dialogue window 1 (`$7E:0379`..`$7E:03A4`, 44 bytes). Corresponds to offset `+$1E` within the window layout descriptor, mirroring `WINDOW_0_DISPLAY_MODE` (`$7E:036B`).
