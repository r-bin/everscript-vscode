---
addr: 90DD26
size: 7
end: 90DD2C
kind: code
category: 🏹
name: projectile_motion_stay
title: Projectile routine $0C — no velocity, per-tick routine $14
confidence: confirmed
tags: [combat, projectile]
evidence: ["disasm: lda #$0014; sta +$26,y; rtl (no velocity is set)", "rom: script-path selector (+$0A) of the record at $90:DAF6 (projectile id 13), launched by opcode 0xB5"]
see: [routines/PROJECTILE_MOVEMENT_ROUTINES.md]
---
Script-path setup that sets no velocity: the projectile stays where opcode 0xB5 put it, run each tick by routine `$14`
(`$90:DFA9`).
