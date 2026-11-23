---
addr: 8E9C28
size: 64
end: 8E9C67
kind: code
category: 🎮
name: shop_menu_load_armor_catalog_items
title: Shop: fill the ring with the ingredients on sale
confidence: confirmed
evidence: ["disasm: run by shop_mode_catalog_loader when $0E6C has bit 8 (shop ids $30-$45, opcode 0x89); each list byte is an ingredient id (tbl_8CE311), 2·id into $C4:5B10 gives its ring item, into the shop ring $0BA5 (2026-11-23)"]
see: ["routines/shop_mode_catalog_loader.md"]
tags: ["shop","alchemy","ingredients","catalog"]
---
Fills the shop ring with the ingredients a shop sells: each byte of `SHOP_ITEM_STREAM_BUF` is an ingredient id, `$C4:5B10`
(ingredient → ring item) gives the ring item. The name (armour) is a misreading: armour goes through `shop_load_catalog`.
