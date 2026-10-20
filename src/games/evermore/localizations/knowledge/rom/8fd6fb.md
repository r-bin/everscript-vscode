---
addr: 8FD6FB
kind: code
category: 🧠
name: enemy_ai_stationary_turret
title: AI Behavior 0x08: Immobile plant and turret hazard loop (12 enemies)
confidence: confirmed
tags: [combat, enemy, ai, turret]
evidence: ["disasm: immobile entity AI loop; polls aggro check $8F:D69B, faces target, triggers stationary attacks (lunge, bite, venom spit, claw swipe)", "docs: docs/entities/enemy_ai.md; clean C in docs/disassembly/entities/enemy-ai.md"]
see: [rom/8fcd17.md, rom/8fd69b.md]
---
Behavior index `0x08` in `$8F:CBE0`, powering 12 stationary hazards (Wimpy Flower, Carniflower, Flowering Death, Tiny Tentacle, Stone Cobra, Thraxx Claws, Sphere Bot):
1. Completely immobile (no movement steps or patrol pathing).
2. Runs aggro detection `$8F:D69B` when target is not acquired.
3. Once target enters range, rotates to face target and triggers attack sequence (bite, claw swipe, or ranged projectile).
