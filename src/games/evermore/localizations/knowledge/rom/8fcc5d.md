---
addr: 8FCC5D
kind: code
category: 🧠
name: recharge_entity_stamina
title: Increment entity weapon stamina meter (+0x2E) up to 100% (0x0400)
confidence: confirmed
tags: [combat, stamina, entity]
evidence: ["disasm: loads stamina from entity+$2E, compares to $0400, adds charge_speed from +$2C, clamps at $0400", "recomp: clean C in docs/disassembly/combat/weapon-charge.md"]
see: [rom/9082d8.md, rom/8fc02b.md]
---
Recharges entity weapon stamina meter `+0x2E` during the main entity tick pass:
- Adds `charge_speed` from entity `+0x2C` every frame.
- Clamps natural regeneration at `0x0400` (1024 = 100% stamina).
- Attacks starting while below 100% deal heavily penalized damage.
