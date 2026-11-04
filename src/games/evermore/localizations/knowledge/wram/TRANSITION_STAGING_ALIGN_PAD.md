---
addr: $7E:24BD
name: TRANSITION_STAGING_ALIGN_PAD
type: u8[6]
tags: [map, script, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
6-byte alignment gap ($7E:24BD..$7E:24C2) between camera pan target object and transition staging cell (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
