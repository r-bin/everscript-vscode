---
addr: 7E234D
size: 1
kind: var
name: CAVE_ENTRANCE_ID
title: Antiqua caves shared room entrance sector index (1..6)
lifetime: transition
confidence: confirmed
tags: [scripts, caves, transition]
evidence: ["script: written in exterior triggers across Antiqua before loading Room 53 (e.g. Room 7 west shore step #6 writes 6 at $96:B928)", "script: tested in Room 53 (quicksand, Bugmuck, volcano, alchemist caves) enter script at $94:A85B..$94:A989 to spawn player at entrances 1 through 6"]
see: [ram/7e24c3.md]
---
Entrance sector selector (1–6) for Room 53, the shared map asset housing all six cave grottos in Antiqua:
- `1`: Quicksand field cave
- `2`: West alchemist cave (gates Hard Ball formula check)
- `3`: Bugmuck access tunnel
- `4`: Volcano path grotto
- `5`: East bluffs cavern
- `6`: West shore cavern (from Room 7)

Staged by exterior cave mouth triggers prior to `load_map(53, ...)` so Room 53's enter script can position the party at the corresponding cave mouth.
