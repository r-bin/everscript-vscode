---
addr: C45B10
end: C45B3B
size: 44
kind: table
category: 📋
name: tbl_C45B10
title: Ingredients — the ring item of each
confidence: confirmed
tags: ["table","alchemy","ingredients","shop"]
evidence: ["disasm: shop_menu_load_armor_catalog_items ($8E:9C3D) lda.l $C45B10,x with X = 2·ingredient (2026-11-23)", "rom: 22 words, ring items $118-$142 in ingredient order"]
---
22 words, ingredient `id` at `2·id`: the ring item a shop ring shows for it (2·ring item id).
