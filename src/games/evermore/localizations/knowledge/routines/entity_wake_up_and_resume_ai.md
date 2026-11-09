---
addr: 8FDF41
size: 14
end: 8FDF4E
kind: code
category: 🎮
name: entity_wake_up_and_resume_ai
title: Despawn a spawner-made entity back into its spawn record
confidence: confirmed
evidence: ["disasm: retrieves active entity index from <$4C; loads target slot offset from +$8C,Y; clears sleep counter at +$08,X; increments state word at +$0C,X; jumps to AI dispatch $8F:B31E; callers: sleep status tick $8F:C40F"]
see: ["routines/entity_collision_slot_deactivate_and_detach.md","routines/entity_sleep_wake.md"]
tags: [entity, status, sleep, ai, widescreen, widescreen.spawn]
---
Called by `entity_sleep_wake` instead of sleeping when the entity came from a spawn record (`+$8C` ≠ 0): clears the record's timer (`+$08`), gives its count back (`+$0C` + 1) and frees the entity through `$8F:B31E`. So spawner enemies are removed, not frozen, once they are more than 48 px off screen with the budget full. Previously believed: wakes the entity and resumes its AI (asm read 2026-11-09).

