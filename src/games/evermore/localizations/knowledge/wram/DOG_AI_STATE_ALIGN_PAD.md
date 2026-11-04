---
addr: $7E:235A
name: DOG_AI_STATE_ALIGN_PAD
type: u8
tags: [dog, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
1-byte alignment gap ($7E:235A) between Great Pyramid sector and Dog AI registers (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
