---
addr: $7E:2265
name: STORY_FLAGS_2265
type: u8[4]
tags: [flags, save, story]
confidence: verified
evidence: ["disasm", "cdl"]
---
Save RAM Subsystem: Persistent story progression, map transition and room-event bitmask flags (bytes 13..16 of save flag block, bit indices 104..135; $7E:2265..$7E:2268; includes room/variant tracking in scripts and opcode 0x0C flag evaluations).

