---
addr: 7E0F40
size: 2
kind: var
name: ENTITY_PTR_DOG
title: Companion (Dog) entity slot address pointer
lifetime: boot
confidence: confirmed
tags: [entity, companion]
evidence: ["disasm: func_CF803C ($8F:8144) stores #$4F37 into $0F40 during companion initialization"]
see: [knowledge/wram/HUD_DRAW_SUPPRESSION_LOCK.md, knowledge/wram/CAMERA_TARGET_ACTOR_PTR.md, knowledge/wram/ENTITY_COMPANION_DOG.md]
---
Direct pointer to the Companion (Dog) entity slot in WRAM (`$7E:4F37`).

Initialized during companion setup in `func_CF803C` (`$8F:8144`). Used by companion AI routines (`$8F:87FE`, `$8F:89A3`), scent-tracking mechanics, waypoint breadcrumb consumption, and party swap controls to reference the dog's state.

