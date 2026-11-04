---
addr: $7E:1514
name: HDMA_RASTER_TIMING_ALIGN_PAD
type: u8[2]
tags: [graphics, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
2-byte alignment buffer ($7E:1514..$7E:1515) preceding HDMA scanline raster timing registers (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
