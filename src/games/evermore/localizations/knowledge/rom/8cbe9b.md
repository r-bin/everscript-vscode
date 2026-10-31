---
addr: 8CBE9B
kind: code
category: 🎮
name: shop_menu_draw_title_header_icon
title: Render shop menu top banner header icon sprite to OAM ($8C:BE9B)
confidence: confirmed
evidence: ["disasm: commits banner header sprite $CC:393E at (160, 14) with priority $32 via $80:9033; callers: shop menu setup $8C:BE28"]
see: ["rom/809033.md","rom/8cbe28.md"]
tags: ["shop","menu","icon","banner","oam"]
---
Renders the shop header banner icon sprite. Commits sprite definition `$CC393E` at screen coordinates (160, 14) with priority `$32` via `direct_sprite_draw_oam` (`$80:9033`).
