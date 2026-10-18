---
addr: 8faff5
end: 8fb020
kind: code
category: 🧠
name: gravity
title: Entity vertical velocity integration, downward acceleration, and ground clamping
confidence: confirmed
tags: [physics, gravity, velocity, entity, actor]
evidence: ["disasm: decrements gravity countdown +$20,X; adds vertical velocity +$1E,X; detects ground plane contact; zeroes vertical momentum upon landing", "trace: executed per entity during each physics tick"]
see: [docs/disassembly/maps/elevation-transfer.md, rom/8fafae.md]
---
Entity vertical gravity physics integrator:
Decrements the entity's gravity acceleration counter at `+$20,X`, sums it with vertical velocity
`+$1E,X`, and updates the vertical position. If downward momentum reaches the ground plane
(result zero or negative underflow), clamps both `+$20,X` and `+$1E,X` to zero, arresting downward
motion and transitioning the entity into a grounded state.
Full disassembly and clean C reconstruction: `docs/disassembly/maps/elevation-transfer.md`.
