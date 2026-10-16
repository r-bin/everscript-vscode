---
addr: 7E3DDF
size: 2
kind: var
name: ENTITY_LIST_HEAD
title: First entity in the active entity list
lifetime: room
confidence: guess
tags: []
evidence: ["disasm: $8F:C61E (DB = $7E) walks from $3DDF, calls a handler chosen by entity+$82 through the table at $8F:C618, follows the next link at entity+$5E until 0 (REA/Ghidra spike, v0.201.7)"]
---
Start of a linked list of entities processed each frame by the entity pass: each record
points to the next one at offset `$5E`, and offset `$82` selects which per-entity routine runs.
A zero link ends the list.
