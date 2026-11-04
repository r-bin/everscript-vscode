---
addr: $7E:0E16
name: CUTSCENE_DIALOGUE_ALIGN_GAP
type: u8[46]
tags: [dialogue, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
46-byte alignment gap ($7E:0E16..$7E:0E43) between cutscene dialogue queue and active BGM track (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
