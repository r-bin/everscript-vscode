---
addr: $7E:0E53
name: APU_TRANSFER_ALIGN_GAP
type: u8[18]
tags: [audio, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
18-byte alignment gap ($7E:0E53..$7E:0E64) between APU transfer depth counter and APU IPC mutex lock (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
