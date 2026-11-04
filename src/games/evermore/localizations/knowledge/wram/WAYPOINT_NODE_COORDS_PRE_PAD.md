---
addr: $7E:3C18
name: WAYPOINT_NODE_COORDS_PRE_PAD
type: u8[4]
tags: [dog, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
4-byte alignment buffer ($7E:3C18..$7E:3C1B) preceding waypoint node world coordinates (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
