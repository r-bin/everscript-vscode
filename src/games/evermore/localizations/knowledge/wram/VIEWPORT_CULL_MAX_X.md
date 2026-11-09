---
addr: $7E:0F4C
name: VIEWPORT_CULL_MAX_X
type: u16
tags: [widescreen, widescreen.collision, widescreen.room_bounds]
confidence: verified
evidence: ["cdl", "disasm"]
---
Camera viewport frustum right bound for 2D entity and shadow culling ($90:9545).

## Widescreen notes

Part of the room-edge inset box at `$7E:0F48` (room width − 14); not a camera value (asm read 2026-11-09).
