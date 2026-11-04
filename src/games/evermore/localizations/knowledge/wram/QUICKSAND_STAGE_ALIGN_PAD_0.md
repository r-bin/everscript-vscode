---
addr: $7E:2484
name: QUICKSAND_STAGE_ALIGN_PAD_0
type: u8
tags: [script, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
1-byte alignment padding ($7E:2484) preceding quicksand object staging table (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
