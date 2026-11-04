---
addr: $7E:08CC
name: CGRAM_UPLOAD_PALETTE_BUF
type: u16[15]
tags: []
confidence: verified
evidence: ["cdl", "disasm"]
---
15-color staging buffer ($7E:08CC..$7E:08E9, 30 bytes) for dynamic sprite palette data uploaded to CGRAM via DMA ($90:8A40).
