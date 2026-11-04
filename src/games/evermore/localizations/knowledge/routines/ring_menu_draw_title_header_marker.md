---
addr: 8DA099
size: 29
end: 8DA0B5
kind: code
category: 🎮
name: ring_menu_draw_title_header_marker
title: Render ring menu top header decorative marker sprite to OAM ($8D:A099)
confidence: confirmed
evidence: ["disasm: commits header marker sprite $CC:3995 at (194, 14) with priority $3A via $80:9033; callers: ring menu idle $8D:9FB6"]
see: ["routines/direct_sprite_draw_oam.md","routines/ring_menu_item_selection_loop.md"]
tags: ["ring-menu","marker","oam","sprite"]
---
Renders ring menu top header decorative marker sprite. Pushes sprite `$CC3995` at screen coordinates (194, 14) with priority `$3A` via `direct_sprite_draw_oam` (`$80:9033`).
