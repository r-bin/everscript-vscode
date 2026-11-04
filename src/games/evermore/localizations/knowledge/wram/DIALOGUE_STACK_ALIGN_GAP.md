---
addr: $7E:0633
name: DIALOGUE_STACK_ALIGN_GAP
type: u8[112]
tags: [dialogue, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
112-byte alignment gap ($7E:0633..$7E:06A2) between dialogue token call stack and ring menu icon slots (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
