---
addr: $7E:0F5A
name: ROOM_PPU_MIRROR_ALIGN_GAP
type: u8[38]
tags: [map, graphics, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
38-byte alignment gap ($7E:0F5A..$7E:0F7F) between projectile cluster tracking registers and room PPU screen mirrors (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
