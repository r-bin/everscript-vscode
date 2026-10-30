---
addr: 8EA9AB
end: 8EAA6A
kind: code
category: 🏪
name: shop_sell_confirmation_prompt_loop
title: Shop item sell confirmation and price prompt loop
confidence: likely
tags: [shop, sell, inventory, currency, menu]
evidence: ["disasm: closes ring menu via $8E:AE85; prepares window $034D; computes 50% resale price; calls $8E:8E39 to confirm selling item; checks bit #$40 on joypad input; loops or commits sale (REA dossier 0x8ea9ab)"]
---
Interactive confirmation loop when selling weapons or items back to a shopkeeper, calculating resale credit and waiting for player confirmation.
