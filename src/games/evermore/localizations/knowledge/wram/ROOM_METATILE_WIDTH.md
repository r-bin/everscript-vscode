---
addr: $7E:08EE
name: ROOM_METATILE_WIDTH
type: u16
tags: [widescreen, widescreen.collision, widescreen.streaming]
confidence: verified
evidence: ["cdl", "disasm"]
---
Active room map width in 16x16 metatiles loaded from room header byte 0 ($90:8E45).

## Widescreen notes

Multiplier of every grid lookup: `tile_property_at_pixel_xy` ($90:9815), `entity_screen_tile_projection` ($90:9561) and the streamer `$90:98FA` compute `row * width` with the hardware multiplier (`$4202` = width, `$4203` = row). Vanilla rooms are 17..128 cells wide (asm read 2026-11-09).
