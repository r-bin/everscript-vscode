---
addr: $7E:240D
name: VENDOR_RECOMMEND_CURRENCY_CHANGE
type: u16
tags: [scripts, market, vendor]
confidence: verified
evidence: ["disasm", "cdl"]
---
Market / Vendor Subsystem: Currency exchange recommendation mode word ($7E:240D, values {$00,$01,$02,$03}; evaluated in call_id(VENDOR_RECOMMEND_CURRENCY_CHANGE) and market dialogue scripts). A value of 0 signals the recommendation to exchange foreign coins into local regional currency.

