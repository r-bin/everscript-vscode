---
addr: $7E:0AF7
name: WEAPON_SKILL_EXP_PADDING
type: u8[16]
tags: [weapon, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
16-byte alignment padding gap ($7E:0AF7..$7E:0B06) between weapon skill experience array and stamina charge capacity (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
