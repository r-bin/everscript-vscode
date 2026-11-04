---
addr: 7E23AF
size: 2
kind: var
name: BARRIER_CENTER_Y
title: Center world Y coordinate of active protective barrier shield circle
lifetime: frame
confidence: confirmed
tags: [spells, combat, barrier, defense]
evidence: ["disasm: func_91C73F ($91:C73F) loads $7E:23AF, shifts left by 1, and stores into $156C as center Y coordinate for spatial circle calculation", "disasm: func_91C899 ($91:C899) uses $156C in circle boundary and raycast tests"]
see: [knowledge/wram/BARRIER_CENTER_X.md, knowledge/wram/BARRIER_RADIUS.md, rom/91c73f.md]
---
Center world Y coordinate of active protective barrier shield circle (Force Field / Barrier spell effect).
Processed during magical shield collision and rendering routines in bank $91.
