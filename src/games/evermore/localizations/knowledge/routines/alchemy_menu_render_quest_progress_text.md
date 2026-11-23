---
addr: 8CC38B
size: 69
end: 8CC3CF
kind: code
category: 🎮
name: alchemy_menu_render_quest_progress_text
title: Prints the description of the picked named item
confidence: confirmed
evidence: ["disasm: $42 = the cursor $0D0D / 2; walks the named items (tbl_8CBBB0 / tbl_8CBBD8), counting held ones down to the picked one, then prints tbl_8CC3D0's line for it into window $03A5 (bank #$C4 at $8C:C3C1) (2026-11-23)"]
see: ["routines/tbl_8CC3D0.md", "routines/window_tilemap_buffer_init.md", "routines/dialogue_format_and_append_line.md"]
tags: ["menu","text","charm","item"]
---
The line under the named items list: the description of the held item the cursor is on. The name (quest progress) is a misreading.
