---
addr: 8CD04A
size: 18
end: 8CD05B
kind: code
category: 🎮
name: dialogue_window_toggle_cursor_mask_bit
title: Toggle matched cursor selection bitmask and update dialogue window ($8C:D04A)
confidence: confirmed
evidence: ["disasm: tests cursor bitmask +$05,Y against +$09,Y; if matched, toggles bit in +$09,Y via EOR and jumps to update handler $8C:D096"]
see: ["routines/dialogue_window_compare_text_buffer_pages.md"]
tags: ["dialogue","cursor","bitmask","toggle"]
---
Checks cursor bitmask `+$05,Y` against `+$09,Y`. If match, toggles the mask bit in `+$09,Y` via `EOR` and jumps to update handler `FUN_8cd096` (`$8C:D096`).
