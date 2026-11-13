---
addr: 8faff5
size: 44
end: 8FB020
kind: code
category: 🧠
name: gravity
title: Entity vertical velocity integration, downward acceleration, and ground clamping
confidence: confirmed
tags: [physics, gravity, velocity, entity, actor, rng, rng.combat]
evidence: ["disasm: decrements gravity countdown +$20,X; adds vertical velocity +$1E,X; detects ground plane contact; zeroes vertical momentum upon landing", "trace: executed per entity during each physics tick", "disasm: $8F:B00F-$8F:B01E: while +$36 (the attacker that last rolled against this entity) is set, decrements +$38 and clears both once it goes below 0: set to 20 by $8F:BA06, so the same attacker cannot strike it for 21 ticks (recomp combat RNG mod soe.debug.combat_rng, 2026-11-11: the flower's second strike frame 6 ticks after a roll found 15 left)"]
see: [docs/disassembly/maps/elevation-transfer.md, routines/entity_physics_and_gravity_tick.md]
---
Entity vertical gravity physics integrator:
Decrements the entity's gravity acceleration counter at `+$20,X`, sums it with vertical velocity
`+$1E,X`, and updates the vertical position. If downward momentum reaches the ground plane
(result zero or negative underflow), clamps both `+$20,X` and `+$1E,X` to zero, arresting downward
motion and transitioning the entity into a grounded state.
Full disassembly and clean C reconstruction: `docs/disassembly/maps/elevation-transfer.md`.

Its tail (`$8F:B00F`) also runs down the strike lockout: `+$38` counts down while `+$36` holds an
attacker, and both are cleared when it passes 0 (docs/entities/combat.md §4).
