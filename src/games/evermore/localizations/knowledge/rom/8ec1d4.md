---
addr: 8EC1D4
end: 8EC3CC
size: 505
kind: table
category: 📋
name: character_records_part_2
title: Character records database continuation (records 40+)
confidence: confirmed
tags: [entities, tables, sprites, table]
evidence: ["disasm: 505 bytes at $8E:C1D4..$8E:C3CC containing 74-byte enemy character record structures directly continuing character_records ($8E:B678..$8E:C1D3)"]
see: [rom/8eb678.md, rom/8eb55a.md]
---
Continuation of the master 74-byte entity character records database (`character_records`). Contains stats (HP, attack, defense, evade, magic defense), experience, money, attack procs, palette addresses, and animation indices for enemy records referenced by the ENEMY index table `$8E:B55A`.
