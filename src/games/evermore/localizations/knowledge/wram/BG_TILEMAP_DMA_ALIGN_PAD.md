---
addr: $7E:15FA
name: BG_TILEMAP_DMA_ALIGN_PAD
type: u16[33]
tags: [graphics, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
6-byte alignment buffer ($7E:15FA..$7E:15FF) following BG tilemap DMA destination address array (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
