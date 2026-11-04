---
addr: $7E:14E2
name: WEATHER_PRESET_ALIGN_PAD
type: u8[2]
tags: [weather, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
2-byte alignment buffer ($7E:14E2..$7E:14E3) in weather simulation registers (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
