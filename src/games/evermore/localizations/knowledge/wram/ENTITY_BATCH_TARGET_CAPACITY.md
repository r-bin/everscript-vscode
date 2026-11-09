---
addr: 7E1070
end: 7E1071
kind: var
name: ENTITY_BATCH_TARGET_CAPACITY
title: Number of awake entities (Boy and Dog included)
lifetime: room
confidence: confirmed
tags: [engine, entity, scheduler, widescreen, widescreen.activation]
evidence: ["rom-asm: $8F:DC8A compares active target capacity LDA $1070 with slice limit CMP $1076", "rom-asm: initialized and adjusted dynamically during room entity allocation"]
see: [docs/disassembly/engine-core/wram-map.md, knowledge/wram/ENTITY_BATCH_PROCESS_LIMIT.md]
---
Counts the awake entities (`+$10` bit `$0100`). Set to 2 (Boy and Dog) at room setup (`$8F:B229`), +1 on every wake (`$8F:C4B1`), −1 on every sleep (`$8F:C514`). Compared with the budget `$7E:1076` by the sleep/wake test and the spawner `$8F:DDBB`. Previously described as a workload capacity (asm read 2026-11-09).

