---
addr: $7E:0B81
name: AUDIO_VOLUME_ALIGN_PAD
type: u8[2]
tags: [audio, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
2-byte alignment padding ($7E:0B81..$7E:0B82) preceding audio target volume (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
