---
addr: 7E0ACF
size: 3
kind: var
name: CREDITS_PURSE
title: Omnitopia currency purse (Credits, 24-bit integer)
lifetime: save
confidence: verified
tags: [inventory, money, economy]
evidence: ["disasm: 24-bit purse held in $7E:0ACF..$7E:0AD1, saved in SRAM", "cheat: unlock(ITEM.MONEY) sets 24-bit value to $65B9AA (6,666,666)"]
---
Holds the current balance of Credits, the futuristic currency used in vending machines and control panels across Omnitopia.
