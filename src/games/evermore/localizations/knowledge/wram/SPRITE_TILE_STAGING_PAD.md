---
addr: $7E:72D0
name: SPRITE_TILE_STAGING_PAD
type: u8
tags: [graphics, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
1-byte alignment padding ($7E:72D0) preceding dynamic sprite tile staging buffer (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
