---
addr: 8EA606
size: 198
end: 8EA6CB
kind: code
category: 🎮
name: ring_armour_loop
title: The armour (body, helm, gloves, collar) ring's loop
confidence: confirmed
tags: ["ring-menu"]
evidence: ["disasm v0.455.0: entry of RING_LOOPS for this ring; prints the item name from RING_ITEMS +0 ($8C:9E03), waits at $8E:ADBC"]
see: ["docs/open-evermore/resources.md"]
---
Runs the armour (body, helm, gloves, collar) ring while it is open: shows the selected item's name, the armour's values from `$C4:3894`, and on confirm equips it.

Previously believed: "Shop era currency balance reader and price formatter" (shop_currency_balance_and_price_formatter).
