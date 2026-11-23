---
addr: 8CC331
end: 8CC38A
size: 90
kind: code
category: 🧠
name: status_menu_alchemy_formula_icon_slot_draw
title: Draws the named items list's icons (charms, key items)
confidence: confirmed
tags: [menu, charm, item]
evidence: ["disasm: X = 2·entry from 0 to $28; the flag word tbl_8CBBB0 and mask tbl_8CBBD8 test the item held; held ones draw tbl_C45A12's sprite at ($02, $04), two columns ($1C / $8C by eor #$0090), a row every second item (+$0D) (2026-11-23)"]
see: [routines/tbl_C45A12.md, routines/tbl_8CBBB0.md]
---
Draws an icon for each named item held, in the list's order and layout. The name (formula icons) is a misreading: the loop reads the named items' tables, not the formulas'.
