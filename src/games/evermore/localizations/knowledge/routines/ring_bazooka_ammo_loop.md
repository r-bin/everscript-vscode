---
addr: 8EA51D
size: 233
end: 8EA605
kind: code
category: 🎮
name: ring_bazooka_ammo_loop
title: The bazooka ammo ring's loop
confidence: confirmed
tags: ["ring-menu"]
evidence: ["disasm v0.455.0: entry of RING_LOOPS for this ring; prints the item name from RING_ITEMS +0 ($8C:9E03), waits at $8E:ADBC"]
see: ["docs/open-evermore/resources.md"]
---
Runs the bazooka ammo ring while it is open: shows the selected item's name, the ammo counts, and on confirm selects the ammo (weapon records by ammo at `$C4:388E`).

Previously believed: "Shop item purchase confirmation details formatter" (shop_buy_confirmation_card_formatter).
