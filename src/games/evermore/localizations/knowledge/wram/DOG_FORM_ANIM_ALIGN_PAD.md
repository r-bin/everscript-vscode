---
addr: $7E:1441
name: DOG_FORM_ANIM_ALIGN_PAD
type: u8[2]
tags: [dog, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
2-byte alignment buffer ($7E:1441..$7E:1442) between Dog sprite animation far pointer and Dog form animation records (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
