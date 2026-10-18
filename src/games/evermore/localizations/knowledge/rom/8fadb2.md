---
addr: 8FADB2
end: 8FADCC
kind: code
category: 🧠
name: drift_diagonal_stairs_bit_13_also
title: Apply 45-degree diagonal stairway drift for tile collision bit 13
confidence: confirmed
tags: [entities, physics, collision, stairs, drift]
evidence: ["disasm: tests collision bit 13 (0x2000) of current tile word +0x38; if set, inspects horizontal delta dx in DP $12; applies vertical drift delta dy -= 1 (moving left/up) or dy += 1 (moving right/down) along 45-degree ramp", "trace: executed by entity movement step to guide actors smoothly along diagonal stairways"]
see: [docs/disassembly/entities/entity-movement.md, rom/8fad51.md]
---
Guides actors traversing diagonal stairways and ramps: tests tile collision
word bit 13 (`0x2000`) and introduces vertical drift to smoothly align movement
along 45-degree isometric inclines.
Full disassembly and clean C reconstruction: `docs/disassembly/entities/entity-movement.md`.
