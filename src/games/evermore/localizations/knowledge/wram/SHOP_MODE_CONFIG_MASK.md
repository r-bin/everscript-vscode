---
addr: $7E:0E6C
name: SHOP_MODE_CONFIG_MASK
type: u16
tags: []
confidence: verified
evidence: ["cdl", "disasm"]
---
Shop Subsystem: which item kinds the shop list holds, set by opcode `0x89` per item: bit `$02` consumables (ids 0-7),
`$04` armour (8-47), `$08` ingredients (48-69); `shop_mode_catalog_loader` picks the loader by it (armour first, then
ingredients, else consumables).
