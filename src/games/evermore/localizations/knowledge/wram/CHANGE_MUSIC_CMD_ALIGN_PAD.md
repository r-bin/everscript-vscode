---
addr: $7E:238A
name: CHANGE_MUSIC_CMD_ALIGN_PAD
type: u8[3]
tags: [audio, script, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
3-byte alignment gap ($7E:238A..$7E:238C) between peddler speech variation index and CHANGE_MUSIC command word (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
