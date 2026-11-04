---
addr: 8FC761
size: 18
end: 8FC772
kind: code
category: 🎮
name: entity_trigger_spell_aoe_if_visible
title: Trigger spell multi-target AoE if target entity is visible ($8F:C761)
confidence: confirmed
evidence: ["disasm: checks entity depth/visibility via entity_sprite_depth $8F:C773; if non-zero, fetches target slot offset +$86,Y and triggers spell_multi_target_aoe_dispatcher $8F:C86C"]
see: ["routines/entity_sprite_depth.md","routines/spell_multi_target_aoe_dispatcher.md"]
tags: ["spell","combat","aoe","entity"]
---
Checks entity visibility and sprite depth via `entity_sprite_depth` (`$8F:C773`). If non-zero, loads spell target slot `+$86,Y` into X and invokes `spell_multi_target_aoe_dispatcher` (`$8F:C86C`).
