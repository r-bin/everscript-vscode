---
addr: 7E107C
end: 7E107D
kind: var
name: ENTITY_SCHEDULER_STABILITY_TIMER
title: Entity scheduler uninterrupted framerate stability timer
lifetime: frame
confidence: confirmed
tags: [engine, entity, scheduler, performance]
evidence: ["rom-asm: $8F:DC5E increments INC $107C on lag-free frames and compares against CMP #$0708 (1800 frames / 30 seconds)", "rom-asm: triggers increment of entity batch limit INC $1076 upon reaching stability threshold"]
see: [docs/disassembly/engine-core/wram-map.md, knowledge/wram/1076.md, knowledge/wram/107a.md]
---
16-bit timer counting consecutive smooth, lag-free frames:
- Incremented by `INC $107C` at `$8F:DC5E` as long as no frame drops are detected.
- When reaching 1800 frames (`$0708` = 30 seconds of solid 60 FPS gameplay), the engine attempts to increase the entity processing batch limit (`INC $1076`), up to the maximum of 6 entities per slice.
- Reset to zero (`STZ $107C`) if 3 consecutive lag frames occur.

