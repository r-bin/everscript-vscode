---
addr: $7E:AE00
name: BANK_7E_RESERVED_RAM
type: u8[0x51FE]
tags: [system, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
20.5 KB unallocated work RAM buffer ($7E:AE00..$7E:FFFD) in Bank $7E (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
