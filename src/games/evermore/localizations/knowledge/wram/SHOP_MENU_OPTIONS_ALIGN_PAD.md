---
addr: $7E:0CED
name: SHOP_MENU_OPTIONS_ALIGN_PAD
type: u8[32]
tags: [dialogue, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
32-byte alignment gap ($7E:0CED..$7E:0D0C) preceding quest and alchemy menu state (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
