---
addr: $7E:2397
name: LOOT_DISPENSE_FLAGS
type: u16[2]
tags: [loot, scripts]
confidence: verified
evidence: ["disasm", "cdl"]
---
Loot Subsystem: Staging registers for loot award presentation and recipient entity ($7E:2397: loot animation/sfx style word; $7E:2399: recipient character entity index, 0 = Boy, 2 = Dog; configured by scripts $94:AD5D, $94:ADC0, $98:D250 before invoking global loot handler).

