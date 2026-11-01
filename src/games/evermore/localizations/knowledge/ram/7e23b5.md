---
addr: 7E23B5
size: 2
kind: var
name: BARRIER_STATE_OR_LIFETIME
title: Barrier state machine mode and remaining lifetime countdown frames
lifetime: frame
confidence: confirmed
tags: [spells, combat, barrier, defense]
evidence: ["disasm: func_91C73F ($91:C73F) evaluates $7E:23B5 modes (0=inactive, 1=collapsing/terminate, 2=active hold, 3=initiate expansion, 4=hold), decrementing when > 4", "disasm: func_91C899 ($91:C899) sets $7E:23B5 on boundary collision"]
see: [ram/7e23b1.md, ram/7e23b3.md, rom/91c73f.md]
---
Magical barrier state machine mode and active frame duration timer.
Controls the active lifecycle of protective shield formulas (such as Force Field / Barrier), sequencing expansion, collision checking, hold duration, and shield collapse.
