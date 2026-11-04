---
addr: $7E:225E
name: STORY_FLAGS_225E
type: u8[2]
tags: [flags, save, story]
confidence: verified
evidence: ["disasm", "cdl"]
---
Save RAM Subsystem: Persistent world progression and quest event bitmask flags (bytes 6 and 7 of save flag block, bit indices 48..63; $7E:225E..$7E:225F; accessed via script opcode 0x0C at $8C:D83E and evaluated across multiple room scripts).

