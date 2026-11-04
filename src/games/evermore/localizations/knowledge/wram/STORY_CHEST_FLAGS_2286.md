---
addr: $7E:2286
name: STORY_CHEST_FLAGS_2286
type: u8[5]
tags: [flags, save, story, loot]
confidence: verified
evidence: ["disasm", "cdl"]
---
Save RAM Subsystem: Persistent story progression, chest opened, and item pickup claimed bitmask flags array (5 bytes, $7E:2286..$7E:228A; covers rooms 0x0E, 0x0F, 0x12, 0x16, 0x24, 0x28, 0x29, 0x4B, 0x60, 0x79).

