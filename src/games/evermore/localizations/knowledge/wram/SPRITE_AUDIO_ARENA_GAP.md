---
addr: $7E:1668
name: SPRITE_AUDIO_ARENA_GAP
type: u8[2456]
tags: [system, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
2,456-byte alignment arena ($7E:1668..$7E:1FFF) between dynamic sprite DMA staging queues and audio attenuation registers (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
