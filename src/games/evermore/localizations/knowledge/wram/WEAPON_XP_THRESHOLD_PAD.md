---
addr: $7E:0BE5
name: WEAPON_XP_THRESHOLD_PAD
type: u8[16]
tags: [weapon, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
16-byte alignment padding gap ($7E:0BE5..$7E:0BF4) preceding weapon experience threshold (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
