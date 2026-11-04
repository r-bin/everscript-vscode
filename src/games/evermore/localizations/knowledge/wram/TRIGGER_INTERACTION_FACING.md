---
addr: 7E2425
end: 7E2428
kind: struct
name: TRIGGER_INTERACTION_FACING
title: Actor facing direction and interaction flags latched at trigger activation
lifetime: room
confidence: confirmed
tags: [room, trigger]
evidence: ["rea: 0x8fabed masks actor offset +$18 bits 4..5 into $2425 (facing direction index 0..3) and bit 6 into $2427 (interaction flags)", "reconstructed-c: 8FACCE_trigger_scanner.c records entity_facing at $2425"]
see: [docs/disassembly/engine-core/wram-map.md]
---
4 bytes preserving secondary actor context when a step-on or B-button interaction trigger fires:
- `$7E:2425` (2 bytes): Facing direction index (0..3) shifted from actor struct field `+$18` bits 4..5 (`(facing & 0x30) >> 4`).
- `$7E:2427` (2 bytes): Interaction status bitmask masked from actor struct field `+$18` bit 6 (`status & 0x40`).

Stored alongside `$7E:2421` (interaction world X) and `$7E:2423` (interaction world Y) immediately prior to invoking script thread dispatcher `func_8CCE4D`.

