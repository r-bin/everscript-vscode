---
addr: $7E:1472
name: MODE7_CAMERA_ALIGN_PAD
type: u8[2]
tags: [mode7, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
2-byte alignment buffer ($7E:1472..$7E:1473) between companion tether limits and Mode 7 flight registers (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
