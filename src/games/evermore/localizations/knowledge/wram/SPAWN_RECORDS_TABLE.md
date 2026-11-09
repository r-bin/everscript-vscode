---
addr: 7E5DC3
end: 7E6182
kind: table
name: SPAWN_RECORDS_TABLE
type: SpawnRecord[60]
title: Enemy and ambient entity respawn descriptor ring table (60 records x 16 bytes)
lifetime: room
confidence: confirmed
tags: [spawn, entity, room, enemy, widescreen, widescreen.spawn]
evidence: ["disasm: func_8FDF14 initializes 60 records at 0x7E:5DC3 (0x3C * 0x10 bytes) and sets cursors 0x0EBE/0x0EC0", "disasm: func_8FDDBB iterates records comparing X/Y with camera viewport ($59/$5B) and invokes func_8FB094 to spawn enemies"]
see: [docs/disassembly/engine-core/wram-map.md]
---
960-byte ring table (`$7E:5DC3`..`$7E:6182`) containing 60 entity spawn and respawn descriptors (16 bytes per descriptor).
Initialized on room enter by `func_8FDF14`, which sets cursors `$7E:0EBE` and `$7E:0EC0` to `$5DC3`.

Descriptor layout (16 bytes, stride `$10`):
- `+$00` (2 bytes): Master enemy/character definition ID or enter script address
- `+$02` (2 bytes): World X spawn coordinate in pixels
- `+$04` (2 bytes): World Y spawn coordinate in pixels
- `+$06` (2 bytes): Spawn attribute flags (elevation, facing, initial state)
- `+$08` (2 bytes): Respawn cooldown countdown timer ticks
- `+$0A` (2 bytes): Respawn interval rate multiplier
- `+$0C` (2 bytes): Active spawn counter / remaining spawn capacity
- `+$0E` (2 bytes): Associated runtime entity slot pointer

Every tick, `func_8FDDBB` advances through the ring: if a spawn coordinate enters the camera visibility window (`X - CAMERA_FINAL_X` and `Y - CAMERA_FINAL_Y`), the spawner decrements its timer and calls `func_8FB094` to allocate an entity slot and instantiate the enemy.
Immediately followed at `$7E:6183` by the spawn loop cycle frame accumulator.

## Widescreen notes

The spawner `$8F:DDBB` visits 10 records per frame. A record with count `+$0C` > 0 and an expired timer `+$08` spawns an entity at `+$02`/`+$04` only when the awake count is below the budget and the point lies 16..48 px outside the screen: inside [−48, 304) on both axes relative to `$59`/`$5B`, but not inside [−16, 272) on both. The entity keeps the record in `+$8C`; when it later drifts more than 48 px off screen with the budget full, `$8F:DF41` returns it to the record (timer 0, count +1) and frees the slot. With a widescreen margin wider than 16 px these spawns land inside the visible margin (asm read 2026-11-09).
