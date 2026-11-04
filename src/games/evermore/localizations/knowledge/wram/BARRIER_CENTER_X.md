---
addr: 7E23AD
size: 2
kind: var
name: BARRIER_CENTER_X
title: Center world X coordinate of active protective barrier shield circle
lifetime: frame
confidence: confirmed
tags: [spells, combat, barrier, defense]
evidence: ["disasm: func_91C73F ($91:C73F) loads $7E:23AD into $156A as center X coordinate for spatial circle calculation", "disasm: func_91C899 ($91:C899) uses $156A in circle boundary and raycast tests"]
see: [ram/7e23af.md, ram/7e23b1.md, rom/91c73f.md]
---
Center world X coordinate of active protective barrier shield circle (Force Field / Barrier spell effect).
Processed during magical shield collision and rendering routines in bank $91.
