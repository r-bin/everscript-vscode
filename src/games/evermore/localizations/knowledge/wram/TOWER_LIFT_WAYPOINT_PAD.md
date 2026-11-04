---
addr: $7E:24ED
name: TOWER_LIFT_WAYPOINT_PAD
type: u8[2]
tags: [script, map, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
2-byte alignment gap ($7E:24ED..$7E:24EE) between cutscene waypoint registers and tower lift coordinates (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
