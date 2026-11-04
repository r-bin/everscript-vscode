---
addr: 7E0379
end: 7E03A4
size: 44
kind: struct
name: WINDOW_DESCRIPTOR_1
title: Dialogue and menu window layout descriptor (secondary dialogue window 1 / Choice box, 44 bytes)
lifetime: session
confidence: confirmed
tags: [dialogue]
evidence: ["disasm: window management routines in bank $80 and $8C index dialogue window descriptors at $7E:034D + stride 44", "docs: docs/disassembly/engine-core/wram-map.md (WindowDescriptor layout)"]
---
Active layout and state descriptor for secondary dialogue window 1 / Choice box (44 bytes).

## Fields
| offset | size | name | meaning |
|---|---|---|---|
| +$00 | 2 | STRING_OFFSET | Current read cursor offset inside active string stream |
| +$02 | 2 | FORMAT_FLAGS | Formatting and layout flags for dialogue window |
| +$04 | 2 | BORDER_STYLE | Border frame graphics style and palette index |
| +$06 | 2 | TEXT_DELAY | Text display speed / delay setting (frames between characters) |
| +$08 | 2 | WAIT_FLAG | Text advance pause flag (0 = printing, 1 = awaiting button press) |
| +$0A | 2 | SCROLL_MODE | Vertical text scrolling speed and mode |
| +$0C | 2 | LINE_INDEX | Current active line number within dialogue window |
| +$0E | 2 | SCREEN_X | Screen X position (pixels) of dialogue window upper-left corner |
| +$10 | 2 | SCREEN_Y | Screen Y position (pixels) of dialogue window upper-left corner |
| +$12 | 2 | VRAM_ADDR | Destination VRAM tilemap word address |
| +$14 | 2 | TILE_WIDTH | Width of dialogue window in 8x8 character tiles |
| +$16 | 2 | TILE_HEIGHT | Height of dialogue window in 8x8 character tiles |
| +$18 | 2 | ANIM_TARGET_WIDTH | Target tile width during window opening animation |
| +$1A | 2 | ANIM_TARGET_HEIGHT | Target tile height during window opening animation |
| +$1C | 2 | MAX_WIDTH | Maximum allowed tile width for dialogue window |
| +$1E | 2 | DISPLAY_MODE | Window display mode flags |
| +$20 | 2 | ANIM_TIMER | Frame countdown timer for window opening / closing animation step |
| +$22 | 2 | RESERVED_22 | Reserved alignment padding field at offset +$22 |
| +$24 | 2 | CHOICE_COUNT | Number of interactive options in choice box |
| +$26 | 2 | SELECTION_CURSOR | Screen position / tile offset of selection arrow cursor |
| +$28 | 2 | SELECTED_CHOICE | Currently selected choice option index (0..N-1) |
| +$2A | 2 | STATE | Window expansion animation lifecycle state (WindowState enum) |
