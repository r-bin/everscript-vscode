---
addr: $7E:0C23
name: RING_MENU_WEAPONS_COUNT
type: u16
tags: []
confidence: verified
evidence: ["cdl", "disasm"]
---
Number of unlocked weapons in the Weapons ring menu: cleared at `$8E:9DFC`, counted up at `$8E:9E1C`. `$7E:07A4` is the shop catalogue's count (`SHOP_EQUIP_WEAPONS_COUNT`).
