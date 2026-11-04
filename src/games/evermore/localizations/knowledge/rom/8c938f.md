---
addr: 8C938F
end: 8C9436
size: 168
kind: table
category: 📋
name: tbl_helmet_defense_power
title: Master helmet equipment Defense Power rating progression table (84 entries)
confidence: confirmed
tags: [equipment, helmet, defense, stats, table]
evidence: ["disasm: 168 bytes at $8C:938F..$8C:9436 containing 84 16-bit word defense ratings; indexed by helmet ID by character_defense_and_buff_rebuild ($8F:83F2)"]
see: [routines/tbl_8C9359.md, rom/8c8f39.md, rom/8c946d.md]
---
Master helmet defense lookup table holding 84 16-bit words (`0x0039, 0x003B, 0x003D, 0x003F...`). Queried during headgear equipping in `character_defense_and_buff_rebuild` (`$8F:83F2`) to increment player defensive thresholds.

