---
addr: 8EA456
size: 199
end: 8EA51C
kind: code
category: 🎮
name: ring_weapons_loop
title: The weapons ring's loop
confidence: confirmed
tags: ["ring-menu"]
evidence: ["disasm v0.455.0: entry of RING_LOOPS for this ring; prints the item name from RING_ITEMS +0 ($8C:9E03), waits at $8E:ADBC"]
see: ["docs/open-evermore/resources.md"]
---
Runs the weapons ring while it is open: shows the selected item's name, its level from the weapon records (`$C4:3874`), and on confirm equips the weapon.

Previously believed: "Shop sell inventory item selection prompt loop" (shop_sell_inventory_item_select_prompt_loop).
