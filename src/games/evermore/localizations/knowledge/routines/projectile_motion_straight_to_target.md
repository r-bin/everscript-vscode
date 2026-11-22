---
addr: 90DCE7
size: 63
end: 90DD25
kind: code
category: 🏹
name: projectile_motion_straight_to_target
title: Projectile routine $0A — fly straight to the target point
confidence: confirmed
tags: [combat, projectile]
evidence: ["disasm: +$26 = $0E (falling); the vector to the target (+$20/+$22 minus +$14/+$16) and +$24 doubled go to $90:DFDF, which scales the step; positions shifted to 1/16 px", "knowledge opcodes/b5.md: the straight movement"]
see: [routines/PROJECTILE_MOVEMENT_ROUTINES.md, routines/projectile_spawn_from_script_opcode_ce.md]
---
Script-path setup: the projectile flies straight from its start to the target point, its speed from opcode 0xB5's last
operand, and from then on falls (per-tick routine `$0E`).
