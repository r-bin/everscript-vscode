---
addr: $7E:0391
size: 2
kind: var
name: WINDOW_1_ANIM_TARGET_WIDTH
title: Target tile width during window opening animation for secondary window 1
lifetime: room
confidence: confirmed
tags: [ui, dialogue, window]
evidence: ["disasm: $8C:553F sta.w $0391 initializes animation target width for window 1 to $A500 in window_system_reset_and_buffers_clear", "disasm: WindowLayoutDescriptor offset +$18 corresponds to anim target width across all window instances"]
see: [knowledge/wram/WINDOW_0_ANIM_TARGET_WIDTH.md, knowledge/wram/WINDOW_1_ANIM_TARGET_HEIGHT.md]
---
Target tile width during opening expansion animation for secondary dialogue window 1 (`$7E:0379`..`$7E:03A4`, 44 bytes). Corresponds to offset `+$18` within the window layout descriptor, mirroring `WINDOW_0_ANIM_TARGET_WIDTH` (`$7E:0365`).
