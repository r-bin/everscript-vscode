---
addr: $7E:0395
size: 2
kind: var
name: WINDOW_1_MAX_WIDTH
title: Maximum allowed tile width for secondary window 1
lifetime: room
confidence: confirmed
tags: [ui, dialogue, window]
evidence: ["disasm: $8C:9E06 lda.w $001C,y loads max width in dialogue_format_and_append_line (Y = $0379 for window 1)", "disasm: WindowLayoutDescriptor offset +$1C holds maximum allowed width in character tiles"]
see: [knowledge/wram/WINDOW_0_MAX_WIDTH.md, knowledge/wram/WINDOW_1_DISPLAY_MODE.md]
---
Maximum allowed tile width constraint for secondary dialogue window 1 (`$7E:0379`..`$7E:03A4`, 44 bytes). Corresponds to offset `+$1C` within the window layout descriptor, mirroring `WINDOW_0_MAX_WIDTH` (`$7E:0369`).
