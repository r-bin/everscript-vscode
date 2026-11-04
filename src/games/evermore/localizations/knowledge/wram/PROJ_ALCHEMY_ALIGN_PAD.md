---
addr: $7E:3914
name: PROJ_ALCHEMY_ALIGN_PAD
type: u8[2]
tags: [weapon, combat, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
2-byte alignment gap ($7E:3914..$7E:3915) following projectile alchemy active array (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
