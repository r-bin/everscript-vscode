---
addr: $7E:3C79
name: WAYPOINT_NODE_1_PAD
type: u8[2]
tags: [dog, combat, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
2-byte trailing alignment padding ($7E:3C79..$7E:3C7A) of waypoint node 1 preceding slot 2 (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
