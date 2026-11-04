---
addr: 8CC38B
size: 69
end: 8CC3CF
kind: code
category: 🎮
name: alchemy_menu_render_quest_progress_text
title: Render alchemy menu quest milestone / objective text ($8C:C38B)
confidence: confirmed
evidence: ["disasm: scans quest bitmask table $8C:BBD8 and WRAM flag pointers $8C:BBB0; decrements quest stage in <$42; if matched, resolves 24-bit text pointer from Bank $C4 table $8C:C3D0 into <$22; initializes window Y=$03A5 via $8C:AF2B and appends text via $8C:9E03; callers: menu renderer $8C:C16C"]
see: ["routines/window_tilemap_buffer_init.md","routines/dialogue_format_and_append_line.md","routines/sub_8CC16C.md"]
tags: ["alchemy","menu","text","quest"]
---
Scans completed story/alchemy quest milestone flags in WRAM against table `$8C:BBB0` / `$8C:BBD8`. Retrieves the corresponding description string from Bank `$C4` pointer table `$8C:C3D0`, clears window `$03A5` via `$8C:AF2B`, and prints the quest objective string via `dialogue_format_and_append_line` (`$8C:9E03`).
