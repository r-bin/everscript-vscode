---
addr: $7E:14CA
name: WEATHER_SIM_STATE_ALIGN_PAD
type: u8[16]
tags: [weather, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
16-byte alignment buffer ($7E:14CA..$7E:14D9) between Mode 7 flight registers and weather particle simulation state (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
