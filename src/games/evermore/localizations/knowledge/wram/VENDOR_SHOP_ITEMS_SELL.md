---
addr: $7E:2457
name: VENDOR_SHOP_ITEMS_SELL
type: u16
tags: [scripts, vendor, shop]
confidence: verified
evidence: ["disasm", "cdl"]
---
Vendor Subsystem: Vendor sell item catalogue descriptor index word ($7E:2457, values $00..$10; evaluated in shop routines $92:C2C7, $92:C2DD). Selects the active item inventory list offered by the merchant when the player engages the sell menu.

