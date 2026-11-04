---
addr: 90DE80
size: 8
end: 90DE87
kind: code
category: 🎮
name: projectile_init_push_elevation
title: Push source entity elevation and initialize projectile physics ($90:DE80)
confidence: confirmed
evidence: ["disasm: loads source entity elevation +$18,X from slot <$4C; pushes onto stack; branches to physics initializer $90:DE8B"]
see: ["routines/projectile_linear_flight_position_and_collision_tick.md"]
tags: ["projectile","elevation","physics","init"]
---
Reads source entity elevation `+$18,X` from slot `<$4C>`, pushes onto stack, and branches to projectile physics initializer `$90:DE8B`.
