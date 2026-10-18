---
addr: 98CCCC
kind: script
name: ebon_keep_gourd_vinegar_or_biscuit
title: Ebon Keep (room 0x7D) gourd — 3 Vinegar or 1 Biscuit
confidence: confirmed
tags: [loot, script]
evidence: ["test: script-model reads two pickups, one per branch: Vinegar with $2461 = 2 (3 in all) and a Biscuit (1), object 5 (tests/script-model/rom.test.js)", "test: the simulation counts in the same amounts (tests/simulation/loot.test.js)"]
see: [ram/7e2461.md, ram/7e2391.md]
---
A B-trigger script of room 0x7D. It branches on a flag: one side stages Vinegar with a bonus of 2
and calls the gourd driver, the other stages a Biscuit. The bonus stays on its own path, which is
why loot has to be read per path (`script-model/paths.ts`).
