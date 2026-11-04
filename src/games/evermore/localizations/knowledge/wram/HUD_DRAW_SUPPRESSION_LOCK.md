---
addr: $7E:0F3E
name: HUD_DRAW_SUPPRESSION_LOCK
type: u16
tags: [mode7, map]
confidence: verified
evidence: ["cdl", "disasm: $8F:80B9, $90:8E40"]
---
In-flight lock counter word suppressing HUD tilemap rendering when non-zero. Paired with VRAM_DMA_LOCK ($7E:0F3A) and CGRAM_DMA_LOCK ($7E:0F3C).
