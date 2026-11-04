---
addr: 8FB463
size: 10
end: 8FB46C
kind: code
category: 🧠
name: entity_spawn_bind_stand_animation
title: Bind Stand Animation on Entity Spawn
confidence: confirmed
evidence: ["disasm: $8F:B463 binds the character record +0x32 'stand' animation script at entity spawn initialization"]
see: [routines/entity_slot_allocate_and_init.md, routines/character_records.md, animation/animation-vm.md]
---
Initializes newly spawned entity animation:
- Reads the `stand` animation ID from character record offset `+0x32`.
- Starts the standing idle animation track before active movement physics begin.
