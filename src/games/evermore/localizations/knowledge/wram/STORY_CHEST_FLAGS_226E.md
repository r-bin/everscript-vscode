---
addr: $7E:226E
name: STORY_CHEST_FLAGS_226E
type: u8[22]
tags: [flags, save, story, loot]
confidence: verified
evidence: ["disasm", "cdl"]
---
Save RAM Subsystem: Persistent story progression, chest opened, and item pickup claimed bitmask flags array (22 bytes, $7E:226E..$7E:2283; covers rooms 0x05, 0x13, 0x1E, 0x23, 0x29, 0x2D, 0x2E, 0x34, 0x37, 0x3B, 0x3C, 0x55, 0x56, 0x65..0x67, 0x71, 0x76, 0x7D).

