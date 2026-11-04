---
addr: $7E:0B44
name: WEAPON_CHARGE_ALIGN_PAD
type: u8[3]
tags: [weapon, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
3-byte alignment padding ($7E:0B44..$7E:0B46) preceding weapon charge meter percentage (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
