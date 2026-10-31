---
addr: 8DDFBB
kind: code
category: 🎮
name: status_menu_draw_weapon_level_icons
title: Render weapon level icons and gauge sprites on status screen ($8D:DFBB)
confidence: confirmed
evidence: ["disasm: draws base gauge sprite $CA:0165 at (26, 88) via $80:9033; reads weapon ID $0B3B; indexes weapon record from $C4:599A; looks up level sprite $8D:E00B; draws icon at (26, 140) via $80:9033; callers: status screen render $8D:DF07"]
see: ["rom/809033.md","rom/8ddf07.md"]
tags: ["status","menu","weapon","icon","oam"]
---
Draws weapon level gauge and icon sprites on the status menu screen. Commits base gauge frame sprite `$CA0165` at position (26, 88) via `direct_sprite_draw_oam` (`$80:9033`). Resolves the active weapon record from `$C4:599A,X` and `$30:02E7`, fetches level icon sprite pointer from table `$8D:E00B`, and draws the level indicator at (26, 140).
