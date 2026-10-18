---
addr: 8FB6CC
kind: code
category: 🧠
name: attack_proc_melee_arc
title: Melee weapon swing hit resolution proc 0
confidence: confirmed
tags: [combat, melee, damage]
evidence: ["disasm: $8F:B6CC jsl $8FBA06; bcc $B6DE; jsl $8FC067; jsl $8FC0D3; jsl $8FC17F; sec; rts", "docs/disassembly/combat/attack-procs.md"]
see: [docs/disassembly/combat/attack-procs.md, docs/disassembly/combat/strike-hittest.md]
---
Standard melee weapon hit resolution proc (index 0 in table `$8F:B6AE`).
Evaluates melee to-hit and invulnerability cooldown via `$8F:BA06`. If hit connects, calculates damage via `$8F:C067`, applies damage and reaction via `$8F:C0D3`, and triggers knockback physics via `$8F:C17F`.
Returns Carry Set (`SEC`) so the strike scan continues across all valid entities in the weapon swing's reach.

## Addresses
- To-hit check: `$8F:BA06`
- Damage computation: `$8F:C067`
- Damage application & hurt state: `$8F:C0D3`
- Knockback recoil physics: `$8F:C17F`
- Dispatch table entry: `$8F:B6AE` (action 0)
