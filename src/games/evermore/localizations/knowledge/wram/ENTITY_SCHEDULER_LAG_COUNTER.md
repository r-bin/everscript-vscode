---
addr: 7E107A
end: 7E107B
kind: var
name: ENTITY_SCHEDULER_LAG_COUNTER
title: Entity scheduler consecutive frame drop counter
lifetime: frame
confidence: confirmed
tags: [engine, entity, scheduler, performance, widescreen, widescreen.activation]
evidence: ["rom-asm: $8F:DC73 increments INC $107A on dropped frame and compares CMP #$0003", "rom-asm: if 3 consecutive lag frames occur, resets stability timer STZ $107C and STZ $107A"]
see: [docs/disassembly/engine-core/wram-map.md, knowledge/wram/ENTITY_SCHEDULER_FRAME_LATCH.md, knowledge/wram/ENTITY_SCHEDULER_STABILITY_TIMER.md]
---
16-bit counter tracking consecutive dropped frames detected by the entity scheduler:
- Incremented at `$8F:DC73` when `$7E:0100 - 1 != $7E:1078`.
- If it reaches 3 consecutive lag frames (`CMP #$0003`), the scheduler resets the stability timer `$7E:107C` and clears this counter to trigger load reduction.
- Cleared to zero (`STZ $107A`) on any smooth, uninterrupted frame.

## Widescreen notes

Lag detection makes the awake budget depend on CPU time: anything that makes a frame longer (more entities, more sprites, more SFX handshakes) can lower `$7E:1076` and so change which entities are simulated. The recomp keeps this identical only while its cycle accounting matches (asm read 2026-11-09).
