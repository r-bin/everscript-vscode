---
addr: 8C888F
size: 61
end: 8C88CB
kind: code
category: 🎮
name: render_damage_popup_sprites_to_oam
title: Render combat damage / recovery popup sprites to OAM ($8C:888F)
confidence: confirmed
evidence: ["disasm: sets Y=$087A; initializes animation record via $90:80D2; walks circular buffer pointer $0B71; computes screen relative coords subtracting camera $59 and $5B (with vertical offset -24); commits sprites via $90:81BD; callers: HUD damage tick $8C:88CC"]
see: ["routines/entity_anim_frame_advance_step.md","routines/anim_record_draw_sprite_to_oam.md","routines/combat_target_selection_cursor_loop.md"]
tags: [combat, hud, damage, oam, sprite, widescreen, widescreen.hud, widescreen.oam]
---
Iterates active damage and healing number popups registered in circular buffer `$0B71`. Translates world coordinates to screen space by subtracting camera position (`<$59`, `<$5B`), adjusts vertical offset by 24 pixels (`#$18`), and pushes number glyphs into Low OAM via `func_9081BD`.
