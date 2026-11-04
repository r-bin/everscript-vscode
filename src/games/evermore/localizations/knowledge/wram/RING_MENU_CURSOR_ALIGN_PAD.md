---
addr: $7E:0BF7
name: RING_MENU_CURSOR_ALIGN_PAD
type: u8[2]
tags: [dialogue, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
2-byte alignment padding ($7E:0BF7..$7E:0BF8) preceding ring menu cursor sector (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
