---
addr: 8CBEB8
kind: code
category: 🎮
name: dialogue_window_render_item_list_sprites
title: Render item list sprite icons in shop/dialogue sub-window ($8C:BEB8)
confidence: confirmed
evidence: ["disasm: scans 12 inventory slots $7E:2517,X; fetches 24-bit sprite descriptor from $C4:5A4E; draws icon at (X=$30, Y) via $80:9033; steps Y by 12 pixels; callers: shop list draw $8C:BE28"]
see: ["rom/809033.md","rom/8cbe28.md"]
tags: ["shop","menu","item","sprite","oam"]
---
Renders item list sprite icons into shop and dialogue sub-windows. Iterates across 12 items in inventory buffer `$7E:2517,X`. Looks up 24-bit sprite pointer from `$C4:5A4E`, draws icon at horizontal position `X = $30` via `direct_sprite_draw_oam` (`$80:9033`), and advances vertical position by 12 pixels per entry.
