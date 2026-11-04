---
addr: $7E:2452
name: VENDOR_ENTITY_ALIGN_PAD
type: u8[3]
tags: [entity, dialogue, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
3-byte alignment gap ($7E:2452..$7E:2454) preceding vendor entity handle (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
