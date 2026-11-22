---
addr: 8CBBD8
end: 8CBBFF
size: 40
kind: table
category: 📋
name: tbl_8CBBD8
title: Named items (charms, key items) — each one's flag bit mask
confidence: confirmed
tags: ["table","menu","charm","item"]
evidence: ["disasm: $8C:C0F0 lda.l $8CBBD8,x / sta $12, then bit $12 against the word from tbl_8CBBB0 (2026-11-23)"]
see: [docs/todo/growable-items.md]
---
20 words, entry `k` at `2·k`: the bit mask of named item `k`'s flag in the word `tbl_8CBBB0` names (Armor Polish
`$2261 & $20` … Wizard's Coin `$2263 & $04`; key items `$2264 & $01`-`$20`). See `tbl_8CBBB0` for the list and its
readers.

Previously described as a generic CDL lookup.
