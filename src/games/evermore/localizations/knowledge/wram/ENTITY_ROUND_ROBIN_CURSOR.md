---
addr: 7E0EBC
end: 7E0EBD
kind: pointer
name: ENTITY_ROUND_ROBIN_CURSOR
title: Entity pool round-robin processing cursor pointer
lifetime: room
confidence: confirmed
tags: [engine, entity, scheduler, pointer, widescreen, widescreen.activation]
evidence: ["rom-asm: $8F:DCA3 LDX $0EBC loads current entity slot pointer", "rom-asm: loops 6 times per frame, stepping by ADC #$008E, wrapping at CMP #$4E89 back to LDA #$3DE5, and saving back with STX $0EBC"]
see: [docs/disassembly/engine-core/wram-map.md, knowledge/wram/ENTITY_BATCH_PROCESS_LIMIT.md]
---
16-bit WRAM pointer storing the current entity pool cursor for round-robin entity execution:
- Evermore maintains 30 dynamic entity slots spanning `$7E:3DE5` to `$7E:4E88` (each slot is 0x8E = 142 bytes).
- At `$8F:DCA3`, the scheduler loads `LDX $0EBC` and processes up to 6 entities per frame (`LDA #$0006` or dynamic slice limit `$7E:1076`).
- For each processed entity, it advances the cursor with `ADC #$008E`. If the cursor reaches the Boy record (`CMP #$4E89`), it wraps around to the beginning of the entity pool (`LDA #$3DE5`).
- Cycles through the entire 30-slot entity pool across 5 consecutive frames.

## Widescreen notes

Next entity slot for the sleep/wake pass; the pass visits 6 slots per frame from `$3DE5` in steps of `$8E`, wrapping before `$4E89` (30 enemy/NPC slots; Boy `$4E89` and Dog `$4F37` follow) (asm read 2026-11-09).
