---
addr: 8CE311
end: 8CE356
size: 70
kind: table
category: 📋
name: tbl_8CE311
title: Shop item id → the byte the shop list holds
confidence: confirmed
tags: ["table","shop"]
evidence: ["disasm: configure_catalog_parameters (opcode 0x89, $8C:E2F5) lda.l $8CE311,x with X = the item id (< 8 consumable, < $30 armour, else ingredient) → SHOP_ITEM_STREAM_BUF (2026-11-23)", "rom: ids 0-7 → 0-7; 8-47 → 2·(id − 7); 48-69 → 0-21"]
---
70 bytes, one per shop item id (opcode `0x89`'s item): what the loader of its category reads. Ids 0-7 consumables (the
consumable id), 8-47 armour (2·(armour + 1), the index into `$C4:5ABE`), 48-69 ingredients (the ingredient id).
