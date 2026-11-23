---
addr: 8E9C68
size: 57
end: 8E9CA0
kind: code
category: 🧠
name: shop_ingredient_catalog_populator
title: Shop: fill the ring with the consumables held (to sell)
confidence: confirmed
tags: [shop, items, consumables, ui]
evidence: ["disasm: loops 8 consumables, lda.l $7E2315,x (their counts), 2·id into $C4:5AAE (consumable → ring item) for each one held; run when a shop's sell page opens and after a sale (alchemy_ingredient_satchel_deduct, $8E:915C) (2026-11-23)"]
see: [docs/disassembly/ui/shop-catalogs.md, docs/disassembly/ui/shop-system.md, routines/shop_load_catalog.md, routines/shop_populate_sell_list.md]
---
Fills the shop ring with every consumable held (counts `$2315 + id`, ring items `$C4:5AAE`), what a shop's sell page offers.
The name (ingredients) is a misreading: `$2315` holds the consumables.
