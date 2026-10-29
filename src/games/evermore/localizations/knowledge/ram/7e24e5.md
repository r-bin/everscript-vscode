---
addr: 7E24E5
size: 2
kind: var
name: SALABOG_ENTITY
title: Entity slot reference to spawned Salabog boss
lifetime: save
confidence: confirmed
tags: [boss, combat, room, enemy.salabog]
evidence: ["evs: Room 0x01 script spawns Salabog and records entity slot via `<0x24e5> = last_entity()`, attaching DAMAGE_DEATH script and executing `teleport_tile(signed <0x24e5>, (30, 34))`", "disasm: opcode 0x18 writes direct-page actor pointer ($0341) into save area $7E:24E5", "scan: docs/scripts/unnamed-memory-audit.md logs 5 accesses in room 0x01"]
see: [ram/7e2533.md, opcodes/3c.md, opcodes/3f.md]
---
Save-area variable holding the entity pointer / slot ID for the Salabog boss in Room `0x01` (Swamp).
Populated immediately following `spawn(SALABOG, 30, 34)` with `last_entity()`, then used to attach event
scripts and reposition the multi-segment boss during combat routines.

