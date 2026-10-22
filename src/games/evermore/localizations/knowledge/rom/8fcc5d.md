---
addr: 8FCC5D
kind: code
category: 🧠
name: recharge_entity_stamina
title: Increment entity weapon stamina meter (+0x2E) up to 100% (0x0400)
confidence: confirmed
tags: [combat, stamina, entity]
evidence: ["disasm: $8F:CC5D `adc $8E002E,x`: adds the character record's +$2E (charge speed), clamps at $0400 (corrected v0.335.0: not entity +$2C)", "recomp: clean C in docs/disassembly/combat/weapon-charge.md"]
see: [rom/9082d8.md, rom/8fc02b.md]
---
Recharges entity weapon stamina meter `+0x2E` during the main entity tick pass:
- Adds `charge_speed` from the character record `+0x2E` every frame, while the entity's `mode` (`+0x16`) has neither bit `$10` nor `$08` (see `rom/8fcc40.md`).
- Clamps natural regeneration at `0x0400` (1024 = 100% stamina).
- Attacks starting while below 100% deal heavily penalized damage.
