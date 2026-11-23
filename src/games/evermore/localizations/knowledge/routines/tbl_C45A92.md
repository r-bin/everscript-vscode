---
addr: C45A92
end: C45A9F
size: 14
kind: table
category: 🧪
name: tbl_C45A92
title: Consumables — the effect block each plays
confidence: confirmed
tags: [table, items, consumables, alchemy]
evidence: ["disasm: item_use_on_target ($8E:8CF9) lda.l $C45A92,x / tax / jsl alchemy_effect_slot_set_timer, as a formula cast passes its block from $C4:5DDF (2026-11-23)", "rom: $66 Petals, Nectar, Honey (block 51); $68 Dog Biscuit (52); $20 Wings (16, Escape's); $64 Essence (50); $52 Pixie Dust (41)"]
see: [routines/item_use_on_target.md]
---
7 words, consumable `id` at `2·id`: 2·k, the block of `$91:80A6` its use plays (Open Evermore names blocks 41, 50, 51, 52 after the first consumable that plays each).
