---
addr: $7E:2549
name: PEDDLER_TRANSACTION_ALIGN_PAD
type: u8[4]
tags: [dialogue, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
4-byte alignment gap ($7E:2549..$7E:254C) between market peddler selection and transaction count (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
