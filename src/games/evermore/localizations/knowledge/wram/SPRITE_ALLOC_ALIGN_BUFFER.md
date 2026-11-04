---
addr: $7E:509D
name: SPRITE_ALLOC_ALIGN_BUFFER
type: u8[10]
tags: [graphics, map, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
10-byte alignment buffer ($7E:509D..$7E:50A6) between map background tile animation descriptor table and sprite allocation pool (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
