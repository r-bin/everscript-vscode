---
addr: $7E:391A
name: DAMAGE_POPUP_PRE_BUFFER
type: u8[292]
tags: [combat, hud, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
292-byte memory buffer ($7E:391A..$7E:3A3D) preceding damage popup nodes (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
