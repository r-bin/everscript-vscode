---
addr: $7E:0F46
name: ROOM_TILE_WIDTH
type: u16
tags: [map]
confidence: verified
evidence: ["cdl", "disasm"]
---
Room map collision/terrain grid width in 8x8 character tiles (row pitch stride = metatile width * 2; $90:8EE2, $8F:B8E3).
