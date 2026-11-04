---
addr: $7E:0B59
name: DIALOGUE_SCROLL_ALIGN_GAP
type: u8[22]
tags: [dialogue, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
22-byte alignment gap ($7E:0B59..$7E:0B6E) preceding dialogue scroll timer (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
