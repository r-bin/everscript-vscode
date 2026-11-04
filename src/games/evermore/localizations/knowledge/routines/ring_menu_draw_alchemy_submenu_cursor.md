---
addr: 8DBD72
size: 58
end: 8DBDAB
kind: code
category: 🎮
name: ring_menu_draw_alchemy_submenu_cursor
title: Render alchemy ring submenu cursor reticle and indicator sprites to OAM ($8D:BD72)
confidence: confirmed
evidence: ["disasm: commits alchemy cursor sprite $CC:39FB at (160, 14) via $80:9033; jumps to commit indicator $CC:3995 at (210, 14) via $80:9033; callers: formula submenu draw $8D:B98F"]
see: ["routines/direct_sprite_draw_oam.md","routines/alchemy_menu_selection_loop.md"]
tags: ["ring-menu","alchemy","cursor","oam","sprite"]
---
Renders alchemy submenu reticle cursor sprites into OAM. Draws primary reticle sprite `$CC39FB` at (160, 14) with priority `$38` via `direct_sprite_draw_oam` (`$80:9033`), followed by indicator marker `$CC3995` at (210, 14).
