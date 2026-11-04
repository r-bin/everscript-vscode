---
addr: 7E23B3
size: 2
kind: var
name: BARRIER_EXPANSION_RATE
title: Radial growth and shrinkage step rate per frame for active barrier circle
lifetime: frame
confidence: confirmed
tags: [spells, combat, barrier, defense]
evidence: ["disasm: func_91C73F ($91:C73F) tests sign of $7E:23B3; stores positive expansion into $157E or negated contraction into $1580, toggling flag in $157C", "disasm: func_91C899 ($91:C899) adds $157E to update radius"]
see: [ram/7e23b1.md, ram/7e23b5.md, rom/91c73f.md]
---
Radial expansion or contraction delta per frame applied to `BARRIER_RADIUS` (`$7E:23B1`).
Controls how rapidly the magical shield bubble inflates upon invocation or deflates when collapsing.
