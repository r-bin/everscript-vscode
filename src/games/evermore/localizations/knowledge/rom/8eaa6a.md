---
addr: 8EAA6A
end: 8EAB2A
kind: code
category: 🏪
name: shop_alchemy_ingredient_purchase_prompt_loop
title: Shop alchemy ingredient purchase confirmation prompt loop
confidence: likely
tags: [shop, alchemy, ingredients, menu]
evidence: ["disasm: closes ring menu via $8E:AE85; initializes window $034D; reads ingredient inventory count from $7E:22FF,X; formats price into decimal ASCII via $80:B21F; delegates to $8E:8F06 to verify player purse before purchase (REA dossier 0x8eaa6a)"]
---
Interactive purchase prompt loop specifically for buying alchemy ingredients from alchemists or market merchants, verifying ingredient capacity (<100) and purse balance.
