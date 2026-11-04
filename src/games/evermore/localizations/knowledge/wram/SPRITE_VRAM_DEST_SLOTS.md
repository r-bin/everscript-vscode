---
addr: $7E:1644
name: SPRITE_VRAM_DEST_SLOTS
type: u16[11]
tags: [graphics]
confidence: verified
evidence: ["cdl", "disasm: $80:82D6, $80:9734, $80:901B"]
---
Dynamic sprite VRAM slot destination word address table (11 slots: 2..12, $7E:1644..$7E:1659, 22 bytes). Tracks destination word addresses for active dynamic sprite slice DMA uploads.
