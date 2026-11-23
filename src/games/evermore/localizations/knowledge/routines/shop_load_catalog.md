---
addr: 8E9BC1
size: 51
end: 8E9BF3
kind: code
category: 🧠
name: shop_load_catalog
title: Shop: fill the ring with the armour on sale
confidence: confirmed
tags: [item]
evidence: ["disasm: run by shop_mode_catalog_loader when $0E6C has bit 4 (shop ids $08-$2F); each list byte is 2·(armour + 1) (tbl_8CE311), the index into $C4:5ABE, the armour → ring item table also read by the armour rings ($8E:9CC7) (2026-11-23)"]
see: [routines/shop_populate_sell_list.md, routines/shop_mode_catalog_loader.md, ui/shop-system.md]
---
Fills the shop ring with the armour a shop sells: each byte of `SHOP_ITEM_STREAM_BUF` indexes `$C4:5ABE` (armour → ring
item; word 0 is no armour). Prices are not in that table: each shop's script gives them (opcode `0x89`, `SHOP_CATALOG_PRICES_BUF`).
Previously believed: `$C4:5ABE` holds prices.
