---
addr: $7E:2487
name: QUICKSAND_STAGE_ALIGN_PAD_1
type: u8[2]
tags: [script, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
2-byte alignment gap ($7E:2487..$7E:2488) between quicksand stage registers (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
