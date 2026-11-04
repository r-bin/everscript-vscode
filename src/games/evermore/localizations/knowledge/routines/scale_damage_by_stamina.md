---
addr: 8FC02B
size: 60
end: 8FC066
kind: code
category: 🧠
name: scale_damage_by_stamina
title: Scale attack power by the attacker's stamina, in five steps
confidence: confirmed
tags: [combat, damage, stamina]
evidence: ["disasm: CPY #$0200 / #$0400 / #$0800 / #$0C00 on rec+$2E into two LSR A, one LSR A, none, one ASL A, two ASL A; bytes $8F:C02B-$8F:C066", "c: G1 passed", "docs: docs/entities/animation_script.md, attack level by stamina"]
see: [routines/select_attack_level_by_stamina.md, routines/recharge_entity_stamina.md]
---
Called by every attack proc for the attacker's power. The base is the character template's word at `$8E:0019` + rec[`$60`];
the Boy (`$4E89`) with weapon `$0ABA` = `$1A` uses `$1468` instead. The stamina meter rec[`$2E`] (full at `$0400`) then scales it in steps:
- Under 50% (`< $0200`): power `$\div 4$`.
- 50% to 99% (`< $0400`): power `$\div 2$`.
- 100% (`< $0800`): power as it is.
- Level 2 charge (`< $0C00`): `$2\times$`.
- Level 3 charge (from `$0C00`): `$4\times$`.
