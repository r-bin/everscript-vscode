---
addr: $7E:1500
name: WEATHER_PARTICLE_STATE_PAD
type: u8[12]
tags: [weather, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
12-byte alignment buffer ($7E:1500..$7E:150B) following weather particle simulation state (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
