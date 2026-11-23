---
addr: C45A84
end: C45A91
size: 14
kind: table
category: 🧪
name: tbl_C45A84
title: Consumables — the target cursor flags of each
confidence: confirmed
tags: [table, items, consumables]
evidence: ["disasm: item_use_on_target ($8E:8CC0) lda.l $C45A84,x with X = 2·consumable → $05AD, then combat_target_selection_cursor_loop (2026-11-23)", "rom: $000A for Petals, Nectar, Honey, Essence, Pixie Dust; $1402 Dog Biscuit; $0208 Wings"]
see: [routines/item_use_on_target.md]
---
7 words, consumable `id` at `2·id`: what the target cursor may pick when it is used (same form as a formula's target, `$C4:5BF5`).
