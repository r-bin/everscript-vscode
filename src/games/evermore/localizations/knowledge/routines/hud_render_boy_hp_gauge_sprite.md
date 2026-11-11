---
addr: 908CEE
size: 63
end: 908D2C
kind: code
category: 🎮
name: hud_render_boy_hp_gauge_sprite
title: Render Boy HP status gauge sprite to OAM ($90:8CEE)
confidence: confirmed
evidence: ["disasm: calculates gauge frame index from HP ratio $0B15 - $1924; loads 24-bit sprite descriptor from [<$5D]; advances pointer; commits sprite at (224, 16) via direct_sprite_draw_oam $80:9033"]
see: ["routines/direct_sprite_draw_oam.md"]
tags: [hud, boy, hp, gauge, oam, widescreen, widescreen.hud, hud.portraits]
---
Renders Boy HP gauge sprite on screen. Computes gauge graphic offset from HP ratio `$0B15 - $1924`, fetches 24-bit sprite descriptor from `[<$5D]`, advances pointer, and draws HP bar sprite at screen position (224, 16) via `direct_sprite_draw_oam` (`$80:9033`).

## Widescreen notes

Draws through `direct_sprite_draw_oam` at fixed screen coordinates (224, 16) (asm read 2026-11-09): a HUD sprite to anchor, not a world sprite.

## Notes

The positions above match no sprite measured on 2026-11-10 (recomp, field, ring menus,
dialogue): the only HUD sprites were the portraits, OBJ `$080` at (8, 201) and `$082` at
(232, 201) (`docs/disassembly/ui/field-hud.md`). Unchecked which sprite this draws.
