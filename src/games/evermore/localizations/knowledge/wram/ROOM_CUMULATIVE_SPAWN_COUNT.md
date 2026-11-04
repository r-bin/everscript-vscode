---
addr: 7E1074
end: 7E1075
kind: var
name: ROOM_CUMULATIVE_SPAWN_COUNT
title: Cumulative entity spawn counter for active room visit
lifetime: room
confidence: confirmed
tags: [engine, entity, room]
evidence: ["rom-asm: $8F:B0A8 executes INC $1074 immediately following INC $1072 during entity allocation", "engine: monotonically increases with every spawn event during room lifecycle"]
see: [docs/disassembly/engine-core/wram-map.md, knowledge/wram/ROOM_SPAWNED_ENTITY_COUNT.md]
---
16-bit monotonic counter tracking the cumulative number of entities spawned since entering the room:
- Incremented by `INC $1074` alongside `$7E:1072` at `$8F:B0A8`.
- Unlike `$7E:1072`, this counter never decrements when entities despawn; it provides unique sequential spawn identifiers and monitors respawn quotas.

