---
addr: $7E:20B0
name: MODE7_PERSPECTIVE_ALIGN_PAD
type: u8[96]
tags: [mode7, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
96-byte alignment buffer ($7E:20B0..$7E:210F) between Mode 7 scaling table and weather particle buffer (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
