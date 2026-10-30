---
addr: 8E9EBE
end: 8E9FA7
kind: code
category: 🏪
name: shop_inventory_menu_setup
title: Shop inventory catalog and sprite cache setup
confidence: likely
tags: [shop, inventory, menu, ui]
evidence: ["disasm: tests mode flag $0E6C bit 4; branches to shop_populate_sell_list ($8E:9CA1) if selling or shop_ingredient_catalog_populator ($8E:9C68) if buying; exits early if count $0BA1 is zero; otherwise allocates VRAM sprite cache slots via $90:CFF0 and loads shopkeeper icons via $90:CEED (REA dossier 0x8e9ebe)"]
---
Populates the shop catalog for buying or selling based on `$0E6C` bit 4 and allocates the necessary sprite slots for merchant inventory display.

