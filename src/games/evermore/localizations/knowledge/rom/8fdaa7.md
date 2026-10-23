---
addr: 8FDAA7
kind: code
category: 🧠
name: enemy_leash_check
title: Leash — an enemy that strays too far from its spawn point walks back
confidence: confirmed
tags: [entities, enemy, ai]
evidence: ["disasm: reads entity +$40 (record +$17 at spawn, $8F:B169); 0 skips the test; halves it while the entity is already in state 6; compares |x − +$26| + |y − +$28| (the spawn point, $8F:B194) with it; when reached, sets state +$78 = 6 and heads for the spawn point (v0.340.1)", "disasm: called from the behaviour routines $8F:D36E (behaviour 0), $8F:D432 (behaviour $12) and $8F:D781 (behaviour $0A)", "cdl: $8F:D36E and $8F:D781 executed in the vanilla library"]
see: [rom/8eb678.md, ram/7e23dd.md, docs/entities/character-properties.md]
---
The roam limit of an enemy. Entity `+$40` holds a distance in pixels, measured as |dx| + |dy|
from the place it spawned (`+$26`, `+$28`). Once the enemy is that far away, it gives up and walks
back. While it walks back the limit is halved, so it really returns before it can chase again.
0 means no leash.
