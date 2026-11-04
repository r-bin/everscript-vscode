---
addr: $7E:1578
name: BARRIER_WINDOW_INNER_PAD
type: u8[4]
tags: [graphics, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
4-byte alignment buffer ($7E:1578..$7E:157B) within barrier window aperture calculations (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
