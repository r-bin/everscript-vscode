---
addr: 8FC1BB
kind: code
category: ⚔️
name: entity_land_on_ground_effect
title: Entity ground touchdown and landing effect handler ($8F:C1BB)
confidence: confirmed
evidence: ["disasm: loads entity pointer from DP $4C; clears airborne flag bit $0040 on +$12,Y; checks if floating (+S16,Y bit 0) or dead (+S2A,Y == 0); reads monster type +$60,Y; plays monster landing sound/effect from table $8E:0048,X or default thud $017F via $90:D858; caller: Gravity_8FAFF5 ($8F:AFFF)"]
see: [rom/90811b.md, rom/90d858.md]
tags: [physics, entities, sound, gravity]
---
Handles an entity touching down onto solid ground at the end of a fall or leap. Clears in-air status bit `$0040` on entity flag word `+$12,Y`. If the entity is alive (`+$2A,Y > 0`) and grounded, queries table `$8E:0048` by monster type `+$60,Y` to play an entity-specific landing sound/effect, or plays default ground touchdown sound `$017F` via `$90:D858`.
