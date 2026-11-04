---
addr: $7E:0DE9
name: MODE7_SPRITE_CACHE_ALIGN_PAD_0
type: u8[2]
tags: [mode7, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
2-byte alignment padding ($7E:0DE9..$7E:0DEA) preceding Mode 7 cockpit overlay animation record (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
