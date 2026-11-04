---
addr: $7E:3024
name: HUD_POPUP_TEXT_PRE_BUFFER
type: u8[0x50]
tags: [dialogue, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer"]
---
80-byte memory buffer ($7E:3024..$7E:3073) between formula usage statistics table and HUD popup text slots (unused to our knowledge).

> **Note**: Unused (to our knowledge: never addressed or written by any instruction in the ROM). Serves as structural alignment padding or reserved space in the SNES WRAM layout.
