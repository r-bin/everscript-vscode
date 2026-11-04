---
addr: $7E:253D
name: DIALOGUE_SELECTION_ALIGN_PAD
type: u8[8]
tags: [dialogue, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
8-byte alignment gap ($7E:253D..$7E:2544) between flight landing parameter and dialogue selection index (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
