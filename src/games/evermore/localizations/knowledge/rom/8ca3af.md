---
addr: 8CA3AF
kind: code
category: 💬
name: dialogue_multiline_text_line_wrap_and_blit
title: Dialogue window multiline text layout, line wrap and glyph blitter ($8C:A3AF)
confidence: confirmed
tags: [dialogue, text, font, blit, menu, formatting]
evidence:
  - "disasm: central text formatting subroutine called by 17 menu routines across banks $8C and $8D (including dialogue_format_and_append_line at $8C:A30E and dialogue_choice_character_append at $8C:B9D2); size 482 bytes ($8C:A3AF..$8C:A590); computes line wrapping boundaries using dialogue_window_find_text_wrap_breakpoint ($8C:AAFA), evaluates character metrics using hardware divider ($4202/$4216), and renders glyphs via font_glyph_bitmap_blit ($8C:A591)"
---

# dialogue_multiline_text_line_wrap_and_blit

Central text formatting and rendering engine for dialogue boxes, shop menus, trade menus, and alchemy formula descriptions. Computes word-wrap breakpoints across lines and draws 1bpp/2bpp font glyphs into UI tilemap VRAM buffers.
