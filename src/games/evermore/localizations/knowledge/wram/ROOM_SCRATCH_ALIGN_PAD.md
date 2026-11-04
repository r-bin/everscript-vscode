---
addr: $7E:23BD
name: ROOM_SCRATCH_ALIGN_PAD
type: u8[2]
tags: [script, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
2-byte alignment gap ($7E:23BD..$7E:23BE) between script target coordinates and room scratch registers (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
