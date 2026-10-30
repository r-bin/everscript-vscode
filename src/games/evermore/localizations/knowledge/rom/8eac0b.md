---
addr: 8EAC0B
end: 8EACEC
kind: code
category: 🏪
name: shop_quantity_selection_menu_loop
title: Shop item quantity selection modal menu loop
confidence: likely
tags: [shop, inventory, quantity, counter, menu]
evidence: ["disasm: closes background ring menu via $8E:AE85; initializes window $034D via $8C:AF2B; loads selected item descriptor from $8E:8000,X; reads joypad button input checking bit #$40; invokes $8E:8FD0 (shop_quantity_selection_counter_loop) to process quantity increment/decrement inputs (REA dossier 0x8eac0b)"]
---
Modal window loop managing the item purchase/sale quantity selection screen in merchant shops, delegating interactive counter increments to $8E:8FD0.
