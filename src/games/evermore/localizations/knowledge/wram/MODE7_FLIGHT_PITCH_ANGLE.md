---
addr: 7E0E72
end: 7E0E73
kind: var
name: MODE7_FLIGHT_PITCH_ANGLE
title: Mode 7 flight vehicle pitch tilt angle
lifetime: room
confidence: confirmed
tags: [engine, mode7, flight, vehicle]
evidence: ["rom-asm: $80:C412 LDA $0E72 tests pitch angle against bounds $0F/$F0 in climb/descent", "rom-asm: controls horizon projection tilt and altitude delta during Mode 7 flight"]
see: [docs/disassembly/engine-core/wram-map.md, knowledge/wram/0e70.md]
---
16-bit integer recording vehicle pitch and climb/dive tilt angle during Mode 7 flight:
- Tested by `func_80C40A` and `func_80C450` to calculate perspective matrix transformation and altitude rate-of-climb.
- In cruise mode (`$7E:0E70 == 2`), tilts with D-Pad Up/Down to control vehicle elevation.

