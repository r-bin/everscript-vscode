---
addr: 8D9A7E
size: 35
end: 8D9AA0
kind: code
category: 🎨
name: ring_menu_draw_cursor_sprite
title: Ring menu selection cursor animation and draw ($8D:9A7E)
confidence: confirmed
evidence: ["disasm: tests bit $10 of UI state word $0D15; if set (suppressed), returns; loads screen coordinates X=$00D0, Y=$0070, priority=$0030 into DP $02..$06; passes cursor animation record Y=$06A3; steps bytecode via $90:80D2; commits sprite to OAM via $90:81BD","see callers: Boy ring menu $8D:91AF, Dog ring menu $8D:9792, ring character switch $8D:94A7"]
see: [routines/ring_menu_boy_selection_loop.md, routines/entity_anim_frame_advance_step.md, routines/anim_record_draw_sprite_to_oam.md]
tags: [ring-menu, sprites, ui]
---
Renders the active ring menu selection cursor arrow. Checks suppression flag bit `$10` in `$0D15`: if unmasked, sets screen coordinates `X = 208` (`$00D0`), `Y = 112` (`$0070`), and priority `$0030`, steps the cursor animation bytecode interpreter (`$90:80D2`) using dedicated animation record `Y = $06A3`, and blits the sprite to OAM via `$90:81BD`.
