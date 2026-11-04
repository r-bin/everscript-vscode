---
addr: 8D9D7A
size: 58
end: 8D9DB3
kind: code
category: 🎮
name: ring_menu_draw_system_options_cursor
title: Render system options ring submenu cursor reticle sprites to OAM ($8D:9D7A)
confidence: confirmed
evidence: ["disasm: commits option cursor sprite $CC:36D3 at (62, 82) with priority $3A via $80:9033; jumps to commit marker $CC:3729 at (61, 119) via $80:9033; callers: system submenu draw $8D:9CD1"]
see: ["routines/direct_sprite_draw_oam.md","routines/ring_menu_alchemy_selection_loop.md"]
tags: ["ring-menu","options","cursor","oam","sprite"]
---
Renders system options ring submenu cursor sprites into OAM. Commits first option reticle `$CC36D3` at (62, 82) with priority `$3A` via `direct_sprite_draw_oam` (`$80:9033`), then commits companion marker `$CC3729` at (61, 119).
