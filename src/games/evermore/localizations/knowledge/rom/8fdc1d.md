---
addr: 8FDC1D
kind: code
category: 🧠
name: enemy_engage_target
title: An enemy engages its target — remembers it, starts the attack
confidence: confirmed
tags: [combat, enemy, ai]
evidence: ["disasm: $8F:DC1D-$8F:DC30 (X = target: entity +$24 = X; the target's +$80 = this enemy unless already set; +$78 = 7; then $90:82D8 picks the attack animation by charge)", "emulator: an exec breakpoint here with Y = the Wimpy Flower counts its attacks; gaps of 102+ frames, 154 on average (tools/routes/fight-in-game.mts, v0.336.0)"]
see: [rom/8fd6fb.md, rom/8fd69b.md, rom/9082d8.md]
---
Where the stationary plants (`$8F:D6FB`) go once the engage test `$8F:D69B` has picked a target: the
target goes into the enemy's `+$24`, the enemy into the target's `+$80` (unless one is there),
state `+$78` = 7, and `$90:82D8` starts the attack animation for the current charge. A breakpoint
here is the cleanest count of an enemy's attacks.
