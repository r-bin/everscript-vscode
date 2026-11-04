---
addr: $7E:3274
name: ALCHEMY_FX_PALETTE_BUFFER
type: u16[16]
tags: [cgram, palette, alchemy, fx]
confidence: verified
evidence: ["disasm", "cdl"]
---
CGRAM transfer buffer ($7E:3274..$7E:3293, 16 words / 32 bytes) for alchemy spell visual effect palette cycling. Updated by spell animation routines ($90:D399) and copied directly into CGRAM via DMA at $80:83BB.

