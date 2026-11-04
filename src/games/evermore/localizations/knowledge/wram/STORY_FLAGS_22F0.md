---
addr: $7E:22F0
name: STORY_FLAGS_22F0
type: u8[10]
tags: [flags, save, story]
confidence: verified
evidence: ["disasm", "cdl"]
---
Save RAM Subsystem: Persistent story progression, room arrival, and Omnitopia duct transition flags array (10 bytes, $7E:22F0..$7E:22F9; includes OMNITOPIA_DUCT_EXIT_ARRIVAL flag at $7E:22F8 bit 0x04; evaluated in rooms 0x00, 0x0D, 0x0F, 0x11, 0x14, 0x19..0x1B, 0x23, 0x24, 0x28, 0x29, 0x42..0x49, 0x4B, 0x4E, 0x54, 0x57, 0x62, 0x68, 0x6B, 0x70..0x72, 0x7A, 0x7E).

