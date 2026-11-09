---
addr: $7E:2435
name: ROOM_AMBIENT_LIGHT_LEVEL
type: u16
tags: [widescreen, widescreen.spawn]
confidence: verified
evidence: ["cdl", "disasm"]
---
Ambient light/shade color tint parameter applied to room palette (default $15).

## Widescreen notes

The spawner `$8F:DDBB` compares `$7E:1074` against this word (`bpl` = stop spawning), so it also acts as a room spawn cap; the light-level meaning was not re-checked (asm read 2026-11-09).
