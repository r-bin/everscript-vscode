---
addr: $7E:ABDA
name: LOW_OAM_ALIGN_PAD
type: u8[4]
tags: [graphics, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
4-byte trailing alignment buffer ($7E:ABDA..$7E:ABDD) preceding low OAM staging buffer (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
