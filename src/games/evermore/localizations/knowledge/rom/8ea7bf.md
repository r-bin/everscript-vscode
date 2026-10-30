---
addr: 8EA7BF
end: 8EA870
kind: code
category: 🏪
name: shop_weapon_purchase_prompt_loop
title: Shop weapon and armor purchase prompt loop
confidence: likely
tags: [shop, weapons, armor, purchase, menu]
evidence: ["disasm: closes ring menu via $8E:AE85; sets window $034D; displays weapon/armor attributes; calls $8E:ADBC to wait for player input; dispatches purchase commit via jump table $A873,X (REA dossier 0x8ea7bf)"]
---
Interactive purchase prompt loop for purchasing weapons, armor, and collars from merchants, displaying equipment stat comparisons.
