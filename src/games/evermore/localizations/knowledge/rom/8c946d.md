---
addr: 8C946D
end: 8C9514
size: 168
kind: table
category: 📋
name: tbl_armlet_defense_power
title: Master armlet and bracer equipment Defense Power rating progression table (84 entries)
confidence: confirmed
tags: [equipment, armlet, bracer, defense, stats, table]
evidence: ["disasm: 168 bytes at $8C:946D..$8C:9514 containing 84 16-bit word defense ratings; indexed by armlet ID by character_defense_and_buff_rebuild ($8F:840C)"]
see: [routines/tbl_8C9437.md, rom/8c8f39.md, rom/8c938f.md]
---
Master armlet and bracer defense lookup table holding 84 16-bit words (`0x001F, 0x0020, 0x0021, 0x0022...`). Queried during arm gear equipping in `character_defense_and_buff_rebuild` (`$8F:840C`) to apply bracer protection bonuses.

