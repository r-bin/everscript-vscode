---
addr: $7E:0393
size: 2
kind: var
name: WINDOW_1_ANIM_TARGET_HEIGHT
title: Target tile height during window opening animation for secondary window 1
lifetime: room
confidence: confirmed
tags: [ui, dialogue, window]
evidence: ["disasm: $8C:5555 sta.w $0393 initializes animation target height for window 1 to $0E80 in window_system_reset_and_buffers_clear", "disasm: WindowLayoutDescriptor offset +$1A corresponds to anim target height across all window instances"]
see: [knowledge/wram/WINDOW_0_ANIM_TARGET_HEIGHT.md, knowledge/wram/WINDOW_1_ANIM_TARGET_WIDTH.md]
---
Target tile height during opening expansion animation for secondary dialogue window 1 (`$7E:0379`..`$7E:03A4`, 44 bytes). Corresponds to offset `+$1A` within the window layout descriptor, mirroring `WINDOW_0_ANIM_TARGET_HEIGHT` (`$7E:0367`).
