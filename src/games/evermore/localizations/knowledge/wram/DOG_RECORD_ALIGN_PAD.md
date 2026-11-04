---
addr: $7E:4FE5
name: DOG_RECORD_ALIGN_PAD
type: u8
tags: [dog, combat, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
1-byte alignment padding ($7E:4FE5) between Dog companion entity record and map anim buffers (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
