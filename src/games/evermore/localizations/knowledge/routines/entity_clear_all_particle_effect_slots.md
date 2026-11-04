---
addr: 91BB27
size: 75
end: 91BB71
kind: code
category: 🎮
name: entity_clear_all_particle_effect_slots
title: Release and clear all attached particle/status slots on entity ($91:BB27)
confidence: confirmed
evidence: ["disasm: calls palette release $90:CDDC; inspects 4 attachment slot pointers at +$46,Y, +$4C,Y, +$52,Y, +$58,Y; deallocates active slots via $91:BB72 and resets to $FFFF; callers: entity death/despawn $90:84A7"]
see: ["routines/entity_apply_palette_slot.md","routines/indirect_action_vector_dispatch_and_free.md","routines/enemy_death_and_loot_drop_processor.md"]
tags: ["entity","vfx","particle","status","dealloc"]
---
Releases attached particle and status effect slots from an entity during despawn or state transitions. Frees palette resources via `func_90CDDC`, then iterates through four attachment pointers (`+$46,Y`, `+$4C,Y`, `+$52,Y`, `+$58,Y`). Calls deallocator `func_91BB72` for any active slots and resets their pointers to `$FFFF`.
