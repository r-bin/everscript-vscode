---
addr: $7E:033F
name: PALETTE_SPAL_ALIGN_PAD
type: u8[2]
tags: [graphics, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
Alignment padding byte buffer ($7E:033F..$7E:0340) between sprite palette buffer 7 and last spawned entity slot index (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
