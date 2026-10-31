---
addr: 8FCC1E
kind: code
category: ⚔️
name: entity_gravity_and_ground_contact_tick
title: Entity gravity acceleration and ground contact collision detector ($8F:CC1E)
confidence: confirmed
tags: [entity, physics, gravity, collision, ground]
evidence:
  - "disasm: called by entity_physics_and_gravity_tick ($8F:B059); size 303 bytes ($8F:CC1E..$8F:CD4C); calculates downward vertical velocity integration on entity Y coordinate, checks vertical terrain bounds, applies floor landing damping, and updates ground contact status flags in entity record ($7E:0EB6, $7E:0EB8)"
---

# entity_gravity_and_ground_contact_tick

Performs gravity integration and floor collision detection for airborne or knocked-back entities. Updates vertical velocity, detects ground contact, and clears airborne state flags.
