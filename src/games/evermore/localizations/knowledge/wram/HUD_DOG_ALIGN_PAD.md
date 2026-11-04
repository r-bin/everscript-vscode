---
addr: $7E:05A5
name: HUD_DOG_ALIGN_PAD
type: u8[2]
tags: [dog, graphics, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
2-byte alignment padding ($7E:05A5..$7E:05A6) between Dog HUD status widget and ring menu caller actor pointer (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
