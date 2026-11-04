---
addr: $7E:14F0
name: WEATHER_WIND_ALIGN_PAD
type: u8[4]
tags: [weather, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
4-byte alignment buffer ($7E:14F0..$7E:14F3) between weather particle slot index and wind control parameters (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
