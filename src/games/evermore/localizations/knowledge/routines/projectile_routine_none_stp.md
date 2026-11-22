---
addr: 90D985
size: 1
end: 90D985
kind: code
category: 🏹
name: projectile_routine_none_stp
title: Projectile routine 0 — STP, the CPU stops
confidence: confirmed
tags: [combat, projectile]
evidence: ["rom: the byte at $90:D985 is $DB (STP); PROJECTILE_MOVEMENT_ROUTINES word 0 points at it", "rom: records with +$08 = 0 ($90:DAF6, $90:DB3E) are launched only by opcode 0xB5, which reads +$0A instead"]
see: [routines/PROJECTILE_MOVEMENT_ROUTINES.md]
---
Selector 0 of the projectile routine table: a lone STP. A record whose routine is 0 must never be thrown by
animation command `0x4C` (`$90:DCA4` would stop the CPU); the two that have it are script projectiles.
