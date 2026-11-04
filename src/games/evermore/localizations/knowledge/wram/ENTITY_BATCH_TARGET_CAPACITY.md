---
addr: 7E1070
end: 7E1071
kind: var
name: ENTITY_BATCH_TARGET_CAPACITY
title: Active entity processing target capacity
lifetime: room
confidence: confirmed
tags: [engine, entity, scheduler]
evidence: ["rom-asm: $8F:DC8A compares active target capacity LDA $1070 with slice limit CMP $1076", "rom-asm: initialized and adjusted dynamically during room entity allocation"]
see: [docs/disassembly/engine-core/wram-map.md, knowledge/wram/1076.md]
---
16-bit integer holding the current target entity workload capacity for the active room:
- Checked against the dynamic slice limit register `$7E:1076` during scheduler frame budgeting.
- Governs whether entity execution batches should be throttled or expanded based on frame timing.

