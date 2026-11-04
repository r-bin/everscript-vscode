---
addr: $7E:037D
size: 2
kind: var
name: WINDOW_1_BORDER_STYLE
title: Border frame graphics style for secondary window 1
lifetime: room
confidence: confirmed
tags: [ui, dialogue, window]
evidence: ["disasm: $8C:9EB5 lda.w $0004,y reads offset +$04 of Window descriptor (where Y = $0379 for window 1)", "disasm: $8C:BCAF sta.w $037D initializes border style for secondary choice box", "cdl: 16-bit word RW accessed during gameplay with observed values 0, 3, 4"]
see: [knowledge/wram/WINDOW_0_BORDER_STYLE.md, knowledge/wram/WINDOW_1_BORDER_COLOR.md]
---
Border frame graphics style and corner tile index for secondary dialogue window 1 / choice prompt box (`$7E:0379`..`$7E:03A4`, 44 bytes). Corresponds to offset `+$04` within the window layout descriptor, mirroring `WINDOW_0_BORDER_STYLE` (`$7E:0351`).
