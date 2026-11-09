---
addr: 7E3DDF
size: 2
kind: var
name: ACTIVE_ENTITY_HEAD
title: First entity in the active entity list
lifetime: room
confidence: guess
tags: [widescreen, widescreen.activation]
evidence: ["disasm: $8F:C61E (DB = $7E) walks from $3DDF, calls a handler chosen by entity+$82 through the table at $8F:C618, follows the next link at entity+$5E until 0 (REA/Ghidra spike, v0.201.7)"]
---
Start of a linked list of entities processed each frame by the entity pass: each record
points to the next one at offset `$5E`, and offset `$82` selects which per-entity routine runs.
A zero link ends the list.

## Widescreen notes

Head of the **awake** list. `entity_linked_list_validate_entity` ($8F:B297) moves a record between this list (`$3D81` + `$5E`) and the asleep list at `$7E:3DE1` (`$3D83` + `$5E`) when it sleeps or wakes, so asleep entities are not visited by the per-frame entity pass: no AI, no drawing (asm read 2026-11-09).
