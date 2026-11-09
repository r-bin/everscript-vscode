---
addr: 8FC514
size: 64
end: 8FC553
kind: code
category: 🧠
name: entity_go_to_sleep
title: Put an entity to sleep: $0100 → $0200, counters $1070 / $1072
confidence: confirmed
tags: [entities, ai, widescreen, widescreen.activation]
evidence: ["disasm: dec $1070, inc $1072; frees its segment list (+$86) and path (+$6A); clears state, mode, z and velocity; +$10 eor #$0300; moves it between the entity lists $3D81 / $3D83 ($8F:B29B) (v0.342.1)", "disasm: called from $8F:C456 (off screen) and the remove routine $8F:B319 (parked entities, +$10 $0008)"]
see: [routines/entity_sleep_wake.md, docs/entities/entities-reference.md]
---
The counterpart of the wake path at `$8F:C4B1`.
