---
addr: 8FBAAF
size: 32
kind: table
category: 📋
name: HIT_CHANCE_POINTERS_BY_EVADE
title: Hit-chance pointers by evade
confidence: confirmed
evidence: ["legacy: migrated from tables.js", "disasm: $8F:BA27-$8F:BAA3 (v0.340.1): row = ((evade + 1) >> 1) & ~1 into these 16 words; column = (min(max(hit, 0), 100) & ~3) >> 1 into the row; a hit when (rand & $7FFF) < the word; 0 never hits", "rom: the rows are 26 words ($34 bytes) apart, $8F:BAE3-$8F:BE22"]
see: [rom/8fba06.md, docs/entities/character-properties.md]
---
Hit-chance pointers by evade. One row per 4 points of the target's evade (`(evade + 1) >> 2`,
16 rows, so evade above 62 would read past the table; vanilla records stop at 50). Each row has 26
words, one per 4 points of the attacker's hit rate clamped to 0–100. A word is the chance out of
`$8000`.
