---
addr: $7E:3C20
name: WAYPOINT_NODE_0_PAD
type: u8[2]
tags: [dog, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
2-byte trailing padding ($7E:3C20..$7E:3C21) of waypoint node 0 preceding node 1 (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
