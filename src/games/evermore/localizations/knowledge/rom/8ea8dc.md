---
addr: 8EA8DC
end: 8EA9AB
kind: code
category: 🏪
name: shop_item_purchase_prompt_loop
title: Shop consumable item purchase prompt loop
confidence: likely
tags: [shop, items, purchase, menu]
evidence: ["disasm: closes ring menu via $8E:AE85; sets window $034D; displays item description; delegates price refresh to $8E:8D6C; awaits input via $8E:ADBC (REA dossier 0x8ea8dc)"]
---
Interactive purchase prompt loop for buying consumable recovery items from general merchants.
