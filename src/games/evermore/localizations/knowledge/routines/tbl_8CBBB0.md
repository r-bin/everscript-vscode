---
addr: 8CBBB0
end: 8CBBD7
size: 40
kind: table
category: 📋
name: tbl_8CBBB0
title: Named items (charms, key items) — the WRAM word of each one's flag
confidence: confirmed
tags: ["table","menu","charm","item"]
evidence: ["disasm: $8C:C0F6 lda.l $8CBBB0,x then lda.l $7E0000,x / bit (the named items list, X = 2·entry up to $26, 2026-11-23)", "rom: the 20 words are $2261-$2264, each paired with a mask in $8C:BBD8 and a name in $8C:BC1A that reads as the item"]
see: [docs/todo/growable-items.md]
---
20 words, entry `k` at `2·k`: the WRAM word that holds named item `k`'s flag (`$2261`-`$2264`). With the masks
(`tbl_8CBBD8`) and the names (`tbl_8CBC1A`) it is the list of charms (entries 0-13, Armor Polish to Wizard's Coin) and key
items (14-19, `$2264` bits 0-5) that the named items sub-menu prints (`$8C:C0E9`, bound `cmp #$0026` at `$8C:C148`). Read
also by `$8F:9215` (equip sync, index `$243D`), `$8C:C403` (count), `$8C:C345`, `$8C:C39B`.

Previously described as a generic CDL lookup.
