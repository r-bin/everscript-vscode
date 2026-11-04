---
addr: $7E:6287
name: SPRITE_ANIM_CHAN_PAD
type: u8[2]
tags: [graphics, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
2-byte trailing alignment padding ($7E:6287..$7E:6288) preceding dynamic sprite animation channel descriptors (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
