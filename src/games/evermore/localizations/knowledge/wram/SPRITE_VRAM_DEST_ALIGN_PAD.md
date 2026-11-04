---
addr: $7E:1642
name: SPRITE_VRAM_DEST_ALIGN_PAD
type: u16
tags: [graphics, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
2-byte alignment buffer ($7E:1642..$7E:1643) preceding sprite VRAM destination table slot 2 (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
