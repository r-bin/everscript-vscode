---
addr: 7E1072
end: 7E1073
kind: var
name: ROOM_SPAWNED_ENTITY_COUNT
title: Current count of spawned active entities in room
lifetime: room
confidence: confirmed
tags: [engine, entity, room, widescreen, widescreen.activation]
evidence: ["rom-asm: $8F:B0A5 executes INC $1072 when placing new entity slot into active room", "rom-asm: checked against room spawn caps during map population"]
see: [docs/disassembly/engine-core/wram-map.md, knowledge/wram/ROOM_CUMULATIVE_SPAWN_COUNT.md]
---
16-bit integer counting active spawned entities currently residing in the active room:
- Incremented by `INC $1072` in routine `func_8FB0A0` whenever a new NPC or monster entity record is allocated.
- Decremented when transient entities despawn or get recycled by the entity manager.

## Widescreen notes

Counts asleep entities: +1 when a slot is allocated (`$8F:B0A4`, new entities start asleep) and on sleep, −1 on wake and when a slot is freed (asm read 2026-11-09).
