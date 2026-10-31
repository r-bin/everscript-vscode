---
addr: 8CC2AA
kind: code
category: 🎮
name: alchemy_menu_draw_title_header_icon
title: Render alchemy menu top banner header icon sprite to OAM ($8C:C2AA)
confidence: confirmed
evidence: ["disasm: commits alchemy title icon sprite $CC:38FC at (160, 14) with priority $32 via $80:9033; callers: alchemy menu layout $8C:C16C"]
see: ["rom/809033.md","rom/8cc16c.md"]
tags: ["alchemy","menu","icon","banner","oam"]
---
Renders alchemy formula menu header icon sprite. Commits sprite `$CC38FC` at screen coordinates (160, 14) with priority `$32` via `direct_sprite_draw_oam` (`$80:9033`).
