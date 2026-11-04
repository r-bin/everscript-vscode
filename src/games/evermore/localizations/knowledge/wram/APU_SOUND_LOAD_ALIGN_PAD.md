---
addr: $7E:0E46
name: APU_SOUND_LOAD_ALIGN_PAD
type: u8
tags: [audio, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
1-byte alignment padding ($7E:0E46) between active BGM track and APU sound loading registers (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
