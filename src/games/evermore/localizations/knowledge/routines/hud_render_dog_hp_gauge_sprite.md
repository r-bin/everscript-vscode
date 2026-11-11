---
addr: 908D2D
size: 76
end: 908D78
kind: code
category: 🎮
name: hud_render_dog_hp_gauge_sprite
title: Render Dog HP status gauge sprite and status indicator to OAM ($90:8D2D)
confidence: confirmed
evidence: ["disasm: indexes dog gauge frame from $7E:2348 in [<$5D]; advances pointer; commits gauge sprite at (96, 162); if status flag $05AB bit 0 is set, draws status icon at (232, 20) via $80:9033"]
see: ["routines/direct_sprite_draw_oam.md"]
tags: [hud, dog, hp, gauge, oam, widescreen, widescreen.hud, hud.portraits]
---
Renders Dog HP gauge sprite on screen. Looks up dog HP gauge frame from `$7E:2348` in table `[<$5D]`, draws status marker sprite at screen position (96, 162), and if dog status flag `$05AB` bit 0 is set, also draws indicator at (232, 20) via `direct_sprite_draw_oam` (`$80:9033`).

## Widescreen notes

Draws at fixed screen coordinates (232, 20) when `$05AB` bit 0 is set and always at (96, 162) (asm read 2026-11-09).

## Notes

The positions above match no sprite measured on 2026-11-10 (recomp, field, ring menus,
dialogue): the only HUD sprites were the portraits, OBJ `$080` at (8, 201) and `$082` at
(232, 201) (`docs/disassembly/ui/field-hud.md`). Unchecked which sprite this draws.
