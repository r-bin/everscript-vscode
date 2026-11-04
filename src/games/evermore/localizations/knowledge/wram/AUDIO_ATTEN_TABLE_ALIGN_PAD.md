---
addr: $7E:2010
name: AUDIO_ATTEN_TABLE_ALIGN_PAD
type: u8[64]
tags: [audio, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
64-byte alignment buffer ($7E:2010..$7E:204F) following audio channel attenuation table (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
