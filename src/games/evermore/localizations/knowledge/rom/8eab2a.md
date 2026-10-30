---
addr: 8EAB2A
end: 8EAC0B
kind: code
category: 🏪
name: shop_transaction_confirm_and_price_display
title: Shop item purchase confirmation and price display
confidence: likely
tags: [shop, transaction, currency, menu]
evidence: ["disasm: formats item price into decimal ASCII via $80:B21F and draws string into window $034D via $8C:9E03; awaits joypad input checking bit #$40; executes sale/purchase commit via $8E:90CA; closes window via $8E:AE85 (REA dossier 0x8eab2a)"]
---
Handles the final purchase confirmation step in merchant shops, displaying the calculated total price, waiting for player confirmation, and calling $8E:90CA to commit the transaction.
