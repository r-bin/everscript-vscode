---
addr: $7E:14EC
name: WEATHER_PARAMS_ALIGN_PAD
type: u16
tags: [weather, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
2-byte alignment buffer ($7E:14EC..$7E:14ED) following weather particle velocity and timer (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
