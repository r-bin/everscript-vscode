---
addr: 8E8CA7
size: 94
end: 8E8D04
kind: code
category: 🧪
name: item_use_on_target
title: Use a consumable — pick a target, count one down, start its effect
confidence: confirmed
tags: [items, consumables, ring, alchemy]
evidence: ["disasm: entry of item_actions 0-6 ($8E:A873, JSR ($A873,x) from ring_items_loop with X = 2·consumable); phx, then lda.l $C45A84,x → $05AD (target flags) and combat_target_selection_cursor_loop; lda $01,s / lsr / tax: lda.l $7E2315,x / dec / sta.l (the count); lda.l $C45AA0,x → effect +$2A; lda.l $C45A92,x → X for alchemy_effect_slot_set_timer (2026-11-23)", "test: Open Evermore v0.461.0, a 10th consumable at power 10 on block petals healed the Boy 5 → 15 HP in game"]
see: [routines/tbl_C45A84.md, routines/tbl_C45A92.md, routines/tbl_consumable_items.md, docs/todo/growable-items.md]
---
What using Petals, Nectar, Honey, a Dog Biscuit, Wings, Essence or Pixie Dust does (consumables 0-6, X = 2·id): the
target cursor with the flags of `$C4:5A84`, then the count at `$2315 + id` goes down by one, and an alchemy effect slot
starts the block `$C4:5A92` names (2·k into `$91:80A6`) with the power of `$C4:5AA0` at its `+$2A`. Call Bead (7) and the
Pouch (8) have handlers of their own.

Previously described as the Dog's attack-target command (a REA guess).
