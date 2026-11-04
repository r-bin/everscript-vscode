---
addr: $7E:64E7
name: PROJECTILE_POOL_POST_BUFFER
type: u8[234]
tags: [weapon, combat, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
234-byte unused RAM buffer ($7E:64E7..$7E:65D0) between projectile entity arena and palette color delta buffer (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
