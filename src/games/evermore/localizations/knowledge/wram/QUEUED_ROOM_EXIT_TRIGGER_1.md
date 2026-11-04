---
addr: 7E23DD
size: 2
kind: var
name: QUEUED_ROOM_EXIT_TRIGGER_1
title: Leash radius for enemies spawned in this room (overrides record +$17)
lifetime: room
confidence: likely
tags: [entities, enemy, ai]
evidence: ["disasm: $8F:B170 and $8F:DEAF use it instead of record +$17 for entity +$40 (the leash, routines/enemy_leash_check.md) when it is not negative (v0.340.1)", "disasm: the room reset $90:8E90 sets it to $FFFF ($90:8F23)", "evs: the compiler's ENEMY_SPAWNER_UNKNOWN_2, seen as 0, $FFFF and once $64"]
see: [routines/enemy_leash_check.md, routines/character_records.md]
---
A room script can set one leash radius for every enemy it spawns afterwards. 0 turns the leash
off. `$FFFF`, the value after a room change, means each enemy keeps its record's own `+$17`.
Previously named as an animation override (`docs/disassembly/PROGRESS.md`, `routines/spawn_stage_deferred_entity.md`).
