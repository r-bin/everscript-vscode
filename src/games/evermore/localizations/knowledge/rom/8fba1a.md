---
addr: 8FBA1A
end: 8FBA3A
kind: code
category: 🧠
name: hit_cooldown_same_attacker_blocked_for_21_ticks
title: 21-frame invulnerability timer and repeat attacker cooldown
confidence: confirmed
tags: [combat, cooldown, invulnerability, hurtbox]
evidence: ["disasm: compares target last-attacker slot (+0x72) against incoming attacker slot (+0x00,y); if matching and cooldown timer (+0x74) > 0, hit is rejected; if attacker is new or timer expired, records attacker ID in +0x72, resets cooldown timer to 21 frames (#$0015 in +0x74), and returns Carry Set", "trace: executed during collision overlap to prevent multi-hit damage from a single attack frame"]
see: [docs/disassembly/combat/to-hit-accuracy.md, rom/8fb75a.md, rom/8fc067.md]
---
Enforces an authentic 21-frame (~0.35s) invulnerability window against repeat
damage from the same attacker slot, preventing frame-stacking multi-hits
while permitting simultaneous damage from different attacking entities.
Full disassembly and clean C reconstruction: `docs/disassembly/combat/to-hit-accuracy.md`.
