---
addr: $7E:0F4A
name: VIEWPORT_CULL_MIN_Y
type: u16
tags: [widescreen, widescreen.collision, widescreen.room_bounds]
confidence: verified
evidence: ["cdl", "disasm"]
---
Camera viewport frustum top bound for 2D entity and shadow culling ($90:9545).

## Widescreen notes

Part of the room-edge inset box at `$7E:0F48` (7 px from the top); not a camera value (asm read 2026-11-09).
