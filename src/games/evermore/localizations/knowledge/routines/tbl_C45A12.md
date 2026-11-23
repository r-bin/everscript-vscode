---
addr: C45A12
end: C45A47
size: 54
kind: table
category: 📋
name: tbl_C45A12
title: Named items (charms, key items) — each one's icon
confidence: confirmed
tags: [table, menu, charm, item]
evidence: ["disasm: $8C:C359 / $8C:C35F lda.l $C45A12,x / $C45A13,x with X = 3·entry (lsr, adc 1,s), stored to $26-$28 for direct_sprite_draw_oam (2026-11-23)", "rom: 20 long pointers $CC:3E16-$CC:3EEF", "test: Open Evermore v0.461.0, a 21st entry pointing at the Wizard's Coin's shows that icon"]
see: [routines/tbl_8CBBB0.md, routines/status_menu_alchemy_formula_icon_slot_draw.md]
---
20 long pointers (3 bytes), entry `k` at `3·k`: the sprite drawn left of named item `k`'s name in the list.
