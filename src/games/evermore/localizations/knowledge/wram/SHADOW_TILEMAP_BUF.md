---
addr: $7F:C800
name: SHADOW_TILEMAP_BUF
type: u16[2048]
tags: [graphics, dialogue, hud, bank7f]
confidence: verified
evidence: ["disasm: 32x32 shadow tilemap RAM for dialogue windows, choice boxes, and HUD border 9-slice frames before VRAM DMA commit ($8C:CC43, $8C:CB64)"]
---
32×32 shadow tilemap RAM for dialogue windows, choice boxes, and HUD border 9-slice frames before VRAM DMA commit ($8C:CC43, $8C:CB64).
