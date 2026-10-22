---
addr: 8FB5FC
end: 8FB692
kind: code
category: 🧠
name: strike_sweep_filter
title: Strike sweep — which entities a strike box may hit
confidence: confirmed
tags: [combat, strike, hit]
evidence: ["disasm: $8F:B5FC-$8F:B611 (side = attacker +$10 bit 2 inverted; mask $5006, | $0020 when the attacker is not the Boy or Dog), $8F:B612-$8F:B61C (walk the entity list $3DDF, skip when (+$10 EOR side) & mask)", "emulator: room 0x38 booted through the intro hook: a Wimpy Flower's strikes swept the Boy but never reached $8F:B61E while his +$10 was $0124; with bit 5 cleared they hit (tools/routes/fight-in-game.mts, v0.336.0)"]
see: [rom/8fba06.md, rom/8fb75a.md, rom/8eb678.md]
---
For every strike box, `$8F:B615` walks the entity list and skips a candidate on the attacker's own
side (`+$10` bit 2) or with any of the mask bits set: `$5006`, plus `$0020` ("left out of
targeting", the record's `+$05` bit 5) when the attacker is an enemy. So an entity with `+$10`
bit 5 can be hit by the party but not by enemies. Then `$8F:B61E` drops the dead, the
invulnerable (`+$16 & $20`), the one this attacker already struck (`+$36`) and closed states
(`+$14 & $070D`), and the box test follows.

Trap: starting the game straight in a room (the intro hook) skips the opening scene, and the Boy
keeps `+$10` bit 5 — no enemy can hit him until it is cleared.
