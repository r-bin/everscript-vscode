---
addr: $7E:2535
name: LOOT_TEXT_ARG_ALIGN_PAD
type: u8[2]
tags: [script, dialogue, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
2-byte alignment gap ($7E:2535..$7E:2536) between overworld zone index and loot text arg (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
