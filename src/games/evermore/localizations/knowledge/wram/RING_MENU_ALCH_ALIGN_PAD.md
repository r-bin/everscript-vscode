---
addr: $7E:0CB3
name: RING_MENU_ALCH_ALIGN_PAD
type: u8[2]
tags: [alchemy, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
2-byte alignment padding ($7E:0CB3..$7E:0CB4) preceding formula action commands submenu (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
