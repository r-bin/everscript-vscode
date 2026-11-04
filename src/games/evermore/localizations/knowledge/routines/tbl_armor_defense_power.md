---
addr: 8C8F39
end: 8C8FE0
size: 168
kind: table
category: 📋
name: tbl_armor_defense_power
title: Master armor equipment Defense Power rating progression table (84 entries)
confidence: confirmed
tags: [equipment, armor, defense, stats, table]
evidence: ["disasm: 168 bytes at $8C:8F39..$8C:8FE0 containing 84 16-bit word defense ratings; indexed by armor ID by character_defense_and_buff_rebuild ($8F:83B2)"]
see: [routines/tbl_8C8F03.md, routines/tbl_dog_atk_base.md, routines/tbl_weapon_attack_power.md]
---
Master equipment defense lookup table holding 84 16-bit words (`0x002B, 0x002C, 0x002C, 0x002D...`). Queried during armor equipping and buff stat recalculation in `character_defense_and_buff_rebuild` (`$8F:83B2`) to add base defense values to entity stats.

