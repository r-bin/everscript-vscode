---
addr: 8EB4DC
kind: code
category: 🎮
name: shop_menu_render_item_glyph_rows
title: Render shop item name font glyph rows to OAM ($8E:B4DC)
confidence: confirmed
evidence: ["disasm: renders font sprite record <$0E> via $90:81BD; advances X offset <$0E> by 16 pixels; increments glyph row counter <$32>; loops to $8E:B34E until line completes"]
see: ["rom/9081bd.md"]
tags: ["shop","font","glyph","oam","text"]
---
Renders item name text glyphs in shop display. Draws font sprite record `<$0E>` via `func_9081BD` (`$90:81BD`), advances horizontal coordinate `<$0E>` by 16 pixels (`#$10`), increments row counter `<$32>`, and loops back to `$8E:B34E`.
