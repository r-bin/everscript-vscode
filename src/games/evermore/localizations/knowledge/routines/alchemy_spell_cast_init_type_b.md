---
addr: 8E871F
size: 71
end: 8E8765
kind: code
category: ✨
name: alchemy_spell_cast_init_type_b
title: Companion/targeted alchemy spell cast initializer Type B ($8E:871F)
confidence: confirmed
evidence: ["disasm: acknowledges joypad input via $80:8597; reads spell descriptor from $C4:5EF7,X into $05AD; allocates animation slot via $91:9759; sets sub-slot link into $0B71; validates target via $8C:88CC; initializes projectile via $91:AD6F; sets duration from $C4:5F57,X via $91:973E; commits cast via $8E:AD67"]
see: [routines/joypad_acknowledge_or_clear_buttons.md, routines/alloc_anim_alchemy_slot.md, routines/alchemy_effect_slot_set_timer.md]
tags: [alchemy, spells, companion]
---
Initializes and validates a companion or targeted alchemy spell cast (Type B). Acknowledges player joypad input, allocates an Animation Alchemy slot via `$91:9759`, verifies target viability via `$8C:88CC`, sets up projectile sprites via `$91:AD6F`, configures duration via `$91:973E`, and triggers spell execution via `$8E:AD67`.
