---
addr: 7E2357
size: 1
kind: var
name: PYRAMID_CURRENT_LEVEL
title: Antiqua Pyramid current floor level index (1 = bottom, 2 = top)
lifetime: room
confidence: confirmed
tags: [scripts, pyramid, antiqua]
evidence: ["script: initialized in Room 85 (bottom level) enter script at $95:9384 as 1", "script: initialized in Room 86 (top level) enter script at $95:9A27 as 2", "script: updated by staircase triggers in R6, R85, R86 to track which pyramid floor the player transitions to"]
see: [ram/7e2350.md, ram/7e2358.md]
---
Current active floor level inside the Antiqua Great Pyramid.
- `1`: Bottom level (Dog exploration area, Room 85)
- `2`: Top level (Boy exploration area, Room 86)
- `0`: Outside / cleared (Room 6)

Used by inter-level staircases and teleporters to route the separated party members to the proper floor elevation.
