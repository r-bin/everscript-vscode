---
addr: $7E:2447
name: TRANSACTION_COST
type: u16
tags: [scripts, market, vendor]
confidence: verified
evidence: ["disasm", "cdl"]
---
Market / Vendor Subsystem: Scripted transaction price / cost staging word ($7E:2447, values {$00,$64}; set to 100 in Nobilia Atlas Medallion vendor script $95:E8A8). Evaluated in $95:E8E8 to compare against the player's Jewels currency and deducted upon purchase confirmation via currency_take(JEWELES, $2447).

