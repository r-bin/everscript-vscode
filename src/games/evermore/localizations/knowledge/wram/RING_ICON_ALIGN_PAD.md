---
addr: $7E:07A3
name: RING_ICON_ALIGN_PAD
type: u8
tags: [dialogue, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
1-byte alignment padding ($7E:07A3) between byte array RING_ICON_SLOTS and 16-bit word-aligned ring menu buffers (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
