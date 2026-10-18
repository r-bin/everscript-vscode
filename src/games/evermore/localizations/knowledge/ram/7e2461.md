---
addr: 7E2461
size: 2
kind: var
name: LOOT_AMOUNT
title: Loot bonus — amount minus one for the next pickup
lifetime: room
confidence: confirmed
tags: [loot]
evidence: ["test: global 0x3e adds 1 + $2461; both loot drivers write 0 when done (simulation, v0.202.0)", "test: Ebon Keep $98:CCCC — the bonus a branch stages does not reach the other branch (tests/simulation/loot.test.js; script-model reads loot per path, tests/script-model/rom.test.js)"]
see: [ram/7e2391.md]
---
The loot script adds `1 + $2461`. Pickups that give more than one write `amount − 1` here
before calling the driver; the drivers reset it to 0 afterwards, so between pickups it is 0
(the simulation's `PINS_BETWEEN_PICKUPS` assumption). Some triggers write it *after* the
call, as a bonus for the next pickup.

The value only travels along one path: in `$98:CCCC` the Vinegar branch stages 2 and ends,
the Biscuit branch is another path (3 Vinegar or 1 Biscuit). `script-model/paths.ts` reads loot
per path for that reason; a linear read of the listing would carry the 2 across.
