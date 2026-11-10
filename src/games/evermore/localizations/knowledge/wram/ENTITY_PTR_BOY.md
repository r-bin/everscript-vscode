---
addr: 7E0F3E
size: 2
kind: var
name: ENTITY_PTR_BOY
title: Player (Boy) entity slot address pointer
lifetime: boot
confidence: confirmed
tags: [entity, boy]
evidence: ["trace: $4E89 in every field dump of the recomp, rooms 0x51 (2026-11-10, adaptive-HUD research)", "disasm: $8F:B434 teleports the Boy through $0F3E and the Dog through $0F40 (spawn_characters_and_position_camera)", "disasm: $8F:D6B9 enemy AI loads the Boy through LDX $0F3E (docs/entities/enemy_ai.md)"]
see: [knowledge/wram/ENTITY_PTR_DOG.md, docs/entities/enemy_ai.md]
---
Direct pointer to the Boy's entity record in WRAM (`$7E:4E89` in play), the first of the two
party pointers; `$0F40` is the Dog's. Routines that act on "the Boy" (status effects, enemy AI
targeting, spawning, the HUD's portrait palette restore) load it from here.

## Notes

Previously believed: `HUD_DRAW_SUPPRESSION_LOCK`, a lock counter that suppresses HUD tilemap
drawing while non-zero. The value is the Boy's record address in every field state measured
(field, ring menus, dialogue), never a small counter, and the routines that read it use it as an
entity pointer.
