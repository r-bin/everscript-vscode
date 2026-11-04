---
addr: $7E:0B85
name: SHOP_ITEM_STREAM_ALIGN_PAD
type: u8[16]
tags: [dialogue, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
16-byte alignment padding gap ($7E:0B85..$7E:0B94) preceding shopkeeper inventory stream buffer (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
