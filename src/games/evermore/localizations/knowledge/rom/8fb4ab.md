---
addr: 8FB4AB
kind: code
category: 🧠
name: test_entity_pair_overlap
title: Test pair overlap using 2:1 isometric ellipse formula (|dx| < sum and 2*|dy| < sum)
confidence: confirmed
tags: [physics, collision, isometric, math]
evidence: ["disasm: loads candidate radius, adds mover radius ($18), tests doubled vertical difference ASL |dy| < $18, tests horizontal difference |dx| < $18", "docs: docs/entities/hitboxes.md; clean C in docs/disassembly/combat/hitbox-intersections.md"]
see: [rom/8fb46d.md]
---
Core isometric body collision algorithm:
- Sums radii of both entities: $r_1 + r_2$.
- Tests vertical distance: $2 \cdot |dy| < (r_1 + r_2)$.
- Tests horizontal distance: $|dx| < (r_1 + r_2)$.
- Models an elliptical contact cylinder with a $2:1$ aspect ratio matching SNES top-down projection.
