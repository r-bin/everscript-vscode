---
addr: 7E244D
size: 2
kind: var
name: LAST_ENTITY_HANDLE
title: Temporary entity struct pointer / handle of most recently spawned NPC
lifetime: room
confidence: confirmed
tags: [scripts, entities, spawn]
evidence: ["scripts: room 0x1D enter script ($99:ED53) assigns <0x244d> = last_entity() immediately after spawn(VILLAGER_2_7, ...), then freezes and faces the entity via signed <0x244d>", "scripts: room 0x4D enter script similarly stages last_entity() into <0x244d> for sequential NPC commands"]
see: [knowledge/wram/ENTITY_DYNAMIC_POOL.md, docs/scripts/unnamed-memory-audit.md]
---
Temporary entity struct pointer (or entity slot index) staged by room scripts immediately after invoking opcode `spawn(...)`.
Used to hold a handle to the newly created actor to immediately issue script directives such as `freeze()`, `face()`, or `attach_script()`. Volatile scratch memory that serves no purpose across saves.
