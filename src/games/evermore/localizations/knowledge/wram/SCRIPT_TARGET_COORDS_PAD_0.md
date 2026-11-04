---
addr: $7E:23B7
name: SCRIPT_TARGET_COORDS_PAD_0
type: u8[2]
tags: [script, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
2-byte alignment gap ($7E:23B7..$7E:23B8) between barrier parameters and script target coordinates (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
