---
addr: 8EB1DA
end: 8EB22F
kind: code
category: 🧠
name: mode7_vehicle_ascent_takeoff_loop
title: Mode 7 vehicle accelerated climb thrust loop until altitude ceiling
confidence: confirmed
tags: [mode7, overworld, vehicle, animation, math]
evidence: ["disasm: triggers engine thrust sound effect 2 via $8C:82DC, enters climb loop adding 10 to altitude $0619 and 4 to pitch $061B per frame, runs frame execution pass (minimap, heading, physics, cockpit, OAM, VBLANK), loops via BRA $8EB1E1 until altitude reaches 255 ceiling ($8EB1EB BPL $8EB231)", "docs/disassembly/engine-core/mode7-landing.md"]
see: [rom/8c82dc.md, rom/8eb14b.md, rom/8eb19b.md, rom/8eb230.md, rom/8eb268.md, docs/disassembly/engine-core/mode7-landing.md]
---
Executes continuous maximum-thrust climb when ascending in the Windwalker on the Mode 7 overworld map:
1. Plays vehicle engine thrust sound effect `2` via `$8C:82DC`.
2. Loops per frame, advancing altitude `$7E:0619` by `+10` and perspective pitch `$7E:061B` by `+4`.
3. Coordinates each frame tick across the minimap blip radar (`$90:9876`), heading trigonometry (`$8E:B33D`),
   actor physics (`$80:96BB`), and seated cockpit occupants (`$8F:C61E`).
4. Once altitude reaches the maximum ceiling of `255` (`0x00FF`), exits the ascent loop and branches
   to level flight perspective settling at `$8E:B231`.
Full disassembly and clean C reconstruction: `docs/disassembly/engine-core/mode7-landing.md`.
