---
addr: 8DC2A2
size: 29
end: 8DC2BE
kind: code
category: 🎮
name: dialogue_menu_draw_page_header_icon
title: Render dialogue menu banner header icon sprite to OAM ($8D:C2A2)
confidence: confirmed
evidence: ["disasm: commits banner header sprite $CC:3831 at (160, 14) with priority $3A via $80:9033; callers: dialogue page setup $8D:C233"]
see: ["routines/direct_sprite_draw_oam.md","routines/sub_8DC233.md"]
tags: ["dialogue","menu","banner","oam","sprite"]
---
Renders dialogue screen banner header icon. Draws sprite definition `$CC3831` at screen position (160, 14) with priority `$3A` via `direct_sprite_draw_oam` (`$80:9033`).
