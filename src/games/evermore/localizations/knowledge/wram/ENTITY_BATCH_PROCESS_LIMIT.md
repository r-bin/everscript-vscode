---
addr: 7E1076
end: 7E1077
kind: var
name: ENTITY_BATCH_PROCESS_LIMIT
title: Dynamic entity execution batch slice limit
lifetime: room
confidence: confirmed
tags: [engine, entity, scheduler, performance]
evidence: ["rom-asm: $8F:DC6A LDA $1076 checks current slice limit against upper bound CMP #$0006", "rom-asm: increments INC $1076 after 1800 lag-free frames ($7E:107C reaching #$0708)", "rom-asm: controls loop slice count in round-robin entity scheduler ($8F:DC9F)"]
see: [docs/disassembly/engine-core/wram-map.md, knowledge/wram/ENTITY_ROUND_ROBIN_CURSOR.md, knowledge/wram/ENTITY_SCHEDULER_STABILITY_TIMER.md]
---
16-bit dynamic execution budget regulating how many entity slots are updated per frame (1..6):
- Defaulted to 6 entities per frame in normal conditions, allowing the 30-slot entity pool to complete a full update cycle every 5 frames.
- If system lag occurs (detected via `$7E:107A`), the budget is reduced to maintain smooth screen rendering.
- When 1800 consecutive lag-free frames (30 seconds at 60 FPS) are measured in `$7E:107C`, `INC $1076` dynamically raises the limit back up to its cap of 6.

