---
addr: $7E:507C
name: MAP_ANIM_CYCLES_ALIGN_PAD
type: u8
tags: [graphics, map, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
1-byte alignment padding ($7E:507C) between map animation cycles array and descriptor table (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
