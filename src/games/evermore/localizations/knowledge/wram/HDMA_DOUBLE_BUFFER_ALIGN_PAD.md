---
addr: $7E:1516
name: HDMA_DOUBLE_BUFFER_ALIGN_PAD
type: u16
tags: [graphics, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
4-byte alignment buffer ($7E:1516..$7E:1519) preceding HDMA scanline double-buffer Bank A (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
