---
addr: $7E:0B53
name: COMBAT_POPUP_QUEUE_ALIGN_PAD
type: u8[4]
tags: [combat, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
4-byte alignment padding ($7E:0B53..$7E:0B56) preceding combat popup queue head pointer (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
