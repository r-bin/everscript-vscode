---
addr: $7E:2361
name: DOG_FORM_INDEX_ALIGN_PAD
type: u8[2]
tags: [dog, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
2-byte alignment gap ($7E:2361..$7E:2362) between companion attack mode and Dog form index (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
