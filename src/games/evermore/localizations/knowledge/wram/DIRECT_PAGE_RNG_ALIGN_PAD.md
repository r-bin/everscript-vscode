---
addr: $7E:012E
name: DIRECT_PAGE_RNG_ALIGN_PAD
type: u8[5]
tags: [system, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
5-byte direct page alignment gap ($7E:012E..$7E:0132) between interrupt dispatch vector and RNG seed state (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
