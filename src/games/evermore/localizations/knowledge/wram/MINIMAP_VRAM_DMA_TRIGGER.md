---
addr: $7E:0FC2
name: MINIMAP_VRAM_DMA_TRIGGER
type: u16
tags: []
confidence: verified
evidence: ["cdl", "disasm"]
---
Flag set when dynamic minimap updates are ready to stream to VRAM via DMA ($90:A5D0).
