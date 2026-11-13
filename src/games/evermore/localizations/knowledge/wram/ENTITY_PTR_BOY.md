---
addr: 7E0F3E
size: 2
kind: var
name: ENTITY_PTR_BOY
title: Player (Boy) entity slot address pointer
lifetime: boot
confidence: confirmed
tags: [entity, boy, script-vm]
evidence: ["trace: $4E89 in every field dump of the recomp, rooms 0x51 (2026-11-10, adaptive-HUD research)", "disasm: $8F:80B4 LDX #$4E89 ; STX $4C ; STX $0F3E ; STX $0F42 in party_records_from_templates — the Boy's record address goes into $0F3E (and the camera/control pointer $0F42)", "disasm: $8F:8144 stores #$4F37 (Dog) into $0F40, the sibling word", "disasm: $8F:B434 teleports the Boy through $0F3E and the Dog through $0F40 (spawn_characters_and_position_camera)", "disasm: $8F:D6B9 enemy AI loads the Boy through LDX $0F3E (docs/entities/enemy_ai.md)", "disasm: script_op_63_select_alchemy passes the entity at $0F3E to the HUD refresh $8F:87FE", "read: expression sub-op $50 of the script VM pushes the word at $0F3E (boy()), $51 the word at $0F40 (dog()), $52 the word at $0F42 (docs/scripts/vm.md)"]
see: [knowledge/wram/ENTITY_PTR_DOG.md, knowledge/wram/CAMERA_TARGET_ACTOR_PTR.md, docs/entities/enemy_ai.md, docs/scripts/vm.md]
---
Direct pointer to the Boy's entity record (`$7E:4E89` in play), the first of the two party
pointers; `$0F40` is the Dog's. Set once when a new game builds the party; read by the menus, the
HUD (portrait palette restore), status effects, enemy AI targeting, spawning and, above all, by
the script engine: the expression sub-op `$50` (Everscript `boy()`) is this word, and with `$0F40`
(`dog()`) and `$0F42` (the character the camera follows) it makes the CHARACTER constants of scripts.

## Notes

Previously believed: `HUD_DRAW_SUPPRESSION_LOCK`, a lock counter that suppresses HUD tilemap
drawing while non-zero. The value is the Boy's record address in every field state measured
(field, ring menus, dialogue), never a small counter, and the routines that read it use it as an
entity pointer. The code cited for the lock ($8F:80B9, $90:8E40) is the initialisation above; the
neighbouring words `$0F3A`/`$0F3C` (VRAM and CGRAM DMA locks) are not touched by this correction.
