---
addr: 8FB7DF
size: 20
end: 8FB7F2
kind: code
category: 🧠
name: attack_proc_melee_no_knockback
title: Attack proc $10 — melee without knockback, shield halving or damage cap
confidence: likely
tags: [combat, damage]
evidence: ["read: the contact handler table $8F:B6AE entry $10 points here (routines/g_attack_proc_table.md, decoded v0.340.1: the handler of $0E without the insect-incense test)", "disasm: $8F:B7D7 tests $2261 bit 7 and falls through to this entry: the to-hit roll $8F:BA06, damage $8F:C067, applied through $8F:C143 (not $8F:C0D3), the retaliation link $8F:C17F"]
see: [routines/g_attack_proc_table.md, routines/attack_proc_status_strike.md, docs/disassembly/combat/attack-procs.md]
---
Attack proc `$10`: the melee hit of proc `$0E` without its insect-incense test. The damage is applied through `$8F:C143` instead of `$8F:C0D3`, so there is no knockback, no shield halving and no 999 cap. No vanilla character record uses it; projectiles may set it in `$0E9A`. Named so Open Evermore's `attack_procs` kind writes every handler by name.
