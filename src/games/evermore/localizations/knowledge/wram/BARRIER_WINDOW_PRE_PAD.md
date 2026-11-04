---
addr: $7E:1562
name: BARRIER_WINDOW_PRE_PAD
type: u8[8]
tags: [graphics, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
8-byte alignment buffer ($7E:1562..$7E:1569) preceding barrier force field window aperture registers (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
