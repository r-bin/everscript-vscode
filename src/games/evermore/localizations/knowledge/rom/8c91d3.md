---
addr: 8C91D3
end: 8C927A
size: 168
kind: table
category: 📋
name: tbl_weapon_attack_power
title: Master weapon equipment Attack Power rating progression table (84 entries)
confidence: confirmed
tags: [equipment, weapon, attack, stats, table]
evidence: ["disasm: 168 bytes at $8C:91D3..$8C:927A containing 84 16-bit word attack power ratings; indexed by weapon ID by character_defense_and_buff_rebuild ($8F:83D8)"]
see: [routines/tbl_8C919D.md, rom/8c8f39.md, rom/8c938f.md]
---
Master weapon attack power lookup table holding 84 16-bit words (`0x0108, 0x0111, 0x011A, 0x0123...`). Queried during weapon swapping and charge attacks in `character_defense_and_buff_rebuild` (`$8F:83D8`) to apply baseline physical damage parameters.
