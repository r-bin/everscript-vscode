---
addr: 7E23B1
size: 2
kind: var
name: BARRIER_RADIUS
title: Current radius in pixels of active protective barrier shield circle
lifetime: frame
confidence: confirmed
tags: [spells, combat, barrier, defense]
evidence: ["disasm: func_91C899 ($91:C899) loads $7E:23B1 into $1570 and computes initial midpoint circle decision variable (1 - r) into $1572 and next delta (3) into $1574", "disasm: checks radius upper limit $C0 and lower limit $02"]
see: [ram/7e23ad.md, ram/7e23af.md, ram/7e23b3.md, ram/7e23b5.md, rom/91c73f.md]
---
Current radius in pixels of the active magical protective barrier circle.
Evaluated in `$91:C899` using a midpoint circle algorithm to compute spatial raycasting and perimeter collision with projectile and enemy actor procs.
