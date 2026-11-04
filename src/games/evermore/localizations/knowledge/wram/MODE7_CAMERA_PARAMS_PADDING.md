---
addr: $7E:1482
name: MODE7_CAMERA_PARAMS_PADDING
type: u8[6]
tags: [mode7, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
6-byte alignment buffer ($7E:1482..$7E:1487) in Mode 7 flight camera parameters table (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
