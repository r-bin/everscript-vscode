---
addr: $7E:0F3A
name: VRAM_DMA_LOCK
type: u16
tags: [system]
confidence: verified
evidence: ["cdl", "disasm"]
---
Active transfer counter and lock word for deferred VRAM DMA queue ($7E:0F3A..$7E:0F3B; incremented on prep, decremented on completion in $80:8A86, $90:8E40).
