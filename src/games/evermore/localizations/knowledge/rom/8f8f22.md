---
addr: 8F8F22
end: 8F90E7
size: 454
kind: code
category: 🧠
name: entity_combat_hitbox_and_state_init
title: Entity combat state initialization and weapon collision hitbox configurator
confidence: confirmed
tags: [entities, combat, hitbox, collision, spawn]
evidence: ["disasm: executes entity combat hitbox and state setup at $8F:8F22..$8F:90E7; unpacks archetype properties via slot offset +$8E, initializes WRAM direct-page pointers $26/$28 into bank $7E, zeroes combat status flags, exits via RTL at $8F:90E7"]
see: [rom/8f8e08.md, rom/8f90e8.md, rom/8fb4ab.md]
---
Initializes newly spawned entity combat records and weapon interaction parameters:
- Reads archetype properties from entity slot offset `+$8E`.
- Configures combat collision radius, strike engagement reach, and direct-page pointers `$26, $28` into WRAM bank `$7E`.
- Clears damage accumulation and active status condition timers.
- Returns via `RTL` at `$8F:90E7`.
