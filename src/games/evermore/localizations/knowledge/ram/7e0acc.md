---
addr: 7E0ACC
size: 3
kind: var
name: COINS_PURSE
title: Medieval currency purse (Gold Coins, 24-bit integer)
lifetime: save
confidence: verified
tags: [inventory, money, economy]
evidence: ["disasm: 24-bit purse held in $7E:0ACC..$7E:0ACE, saved in SRAM", "cheat: unlock(ITEM.MONEY) sets 24-bit value to $65B9AA (6,666,666)"]
---
Holds the current balance of Gold Coins, the currency utilized in Iglis, Ebon Keep, and throughout Gothica.
