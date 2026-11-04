---
addr: $7E:6389
name: PROJECTILE_ENTITY_POOL
type: u8[350]
tags: [combat, entity, projectiles]
confidence: confirmed
evidence: ["disasm: projectile_entity_slot_link_init ($90:DC21) steps in 44-byte increments (#$2C) through $6387..$64E7, clearing active link field +$10,X", "disasm: projectile_entity_slot_allocate_and_init ($90:DC41) allocates 44-byte projectile slots for spell/weapon missiles"]
---
Active projectile entity slot allocation arena (8 slots × 44 bytes minus 2 bytes header: initial coordinates, velocities, sprite descriptor, and lifetime timers).
