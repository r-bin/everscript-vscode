---
addr: 7E0E70
end: 7E0E71
kind: enum
name: MODE7_FLIGHT_STATE
title: Mode 7 Windwalker vehicle flight navigation state machine
lifetime: room
confidence: confirmed
tags: [engine, mode7, flight, vehicle]
evidence: ["rom-asm: $80:C4A3 evaluates flight phase: 0=ground, 1=takeoff ascent, 2=flight cruising, 3=landing descent, 4=touchdown, 5=realm transition", "rom-asm: initialized/cleared by $80:C50D STZ $0E70, set to 1 by $8E:9882 on Windwalker launch"]
see: [docs/disassembly/engine-core/wram-map.md, knowledge/wram/0e72.md, knowledge/wram/22ef.md]
---
16-bit state enum controlling the Mode 7 3D flight engine for the Windwalker flying machine:
- `0`: Ground mode (normal walking/running physics, Mode 7 rendering inactive).
- `1`: Takeoff sequence (vehicle climbs into sky; pitch angle `$7E:0E72` and altitude `$7E:14B0` ascend).
- `2`: Free cruising flight (player steers overworld vehicle across realms).
- `3`: Landing approach descent.
- `4`: Touchdown dock (vehicle lands at landing site).
- `5`: Realm map border transition.

