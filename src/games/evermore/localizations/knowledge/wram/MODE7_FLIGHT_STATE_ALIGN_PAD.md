---
addr: $7E:0E6E
name: MODE7_FLIGHT_STATE_ALIGN_PAD
type: u8[2]
tags: [mode7, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
2-byte alignment padding ($7E:0E6E..$7E:0E6F) between shop mode config mask and Mode 7 flight state (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
