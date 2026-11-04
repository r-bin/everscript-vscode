---
addr: 7E0E98
end: 7E0E99
kind: var
name: ENTITY_SCHEDULER_INTERVAL_TARGET
title: Entity scheduler secondary jitter countdown timer
lifetime: room
confidence: confirmed
tags: [engine, entity, scheduler, timer]
evidence: ["rom-asm: $8F:DC34 decrements $7E:0E98 with DEC $0E98 and branches if positive", "rom-asm: reloads via RNG $80:859B masked with $00FF + $003C (60..315 frames)"]
see: [docs/disassembly/engine-core/wram-map.md, knowledge/wram/ENTITY_SCHEDULER_INTERVAL_TIMER.md]
---
16-bit countdown register providing secondary jitter timing for entity scheduler events:
- Decremented each scheduler tick (`DEC $0E98`).
- When negative (`BPL` fails), triggers re-evaluation and reloads from RNG `$80:859B` masked `AND #$00FF` plus `ADC #$003C` (60..315 frames).

