---
addr: $7E:3BFE
name: BREADCRUMB_QUEUE_ALIGN_PAD
type: u8
tags: [dog, map, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
1-byte alignment padding ($7E:3BFE) preceding companion breadcrumb queue tail pointer (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
