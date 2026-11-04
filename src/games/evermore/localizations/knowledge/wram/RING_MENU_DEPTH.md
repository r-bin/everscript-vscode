---
addr: $7E:034B
size: 2
kind: var
name: RING_MENU_DEPTH
title: Ring menu hierarchy nesting depth level
lifetime: room
confidence: confirmed
tags: [menu, ui]
evidence: ["disasm: $8E:A2DE inc.w $034B upon entering submenu / nested ring category (tests joypad bit $0008)", "disasm: $8E:A370 dec.w $034B upon backing out / cancelling from submenu (tests depth at $8E:A367 before dec)", "disasm: $8E:92AE, $8E:9325, $8E:939C, $8E:9450, $8E:94C2, $8E:9534, $8E:95A6 stz.w $034B to reset nesting depth to 0 on opening status or ring menus", "disasm: $8E:A32E stz.w $034B to reset depth to 0 when toggling Boy/Dog with Select button", "cdl: 16-bit word RW accessed during gameplay with observed values 0, 1, 2"]
see: [knowledge/wram/JOYPAD_REPEAT_RATE.md, knowledge/wram/WINDOW_0_STRING_OFFSET.md]
---
Current nesting depth level within the ring menu hierarchy (0 = root ring menu, 1 = 1st submenu ring, 2 = 2nd submenu ring).

When navigating ring categories or diving into sub-rings (e.g. formulas or sub-items), `$8E:A2DE` executes `INC $034B`. When the player cancels or presses B to back out of a sub-ring, `$8E:A367` tests `$034B`; if non-zero, it decrements the depth with `DEC $034B` (`$8E:A370`), restores the parent ring descriptor from stack, and remains in the menu. If depth is already 0, it calls `$8E:A39E` to tear down the ring menu and return to the field.

Reset to 0 upon menu activation (`STZ $034B` across all ring and status menu entrypoints) and when switching active characters with Select (`$8E:A32E`).
