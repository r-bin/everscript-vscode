---
addr: 8EA7BF
size: 178
end: 8EA870
kind: code
category: 🎮
name: ring_items_loop
title: The items ring's loop
confidence: confirmed
tags: ["ring-menu"]
evidence: ["disasm v0.455.0: entry of RING_LOOPS for this ring; prints the item name from RING_ITEMS +0 ($8C:9E03), waits at $8E:ADBC"]
see: ["docs/open-evermore/resources.md"]
---
Runs the items ring while it is open: shows the selected item's name, the count held, and on confirm runs `ITEM_RING_ACTIONS` by the item's index.

Previously believed: "Shop weapon and armor purchase prompt loop" (shop_weapon_purchase_prompt_loop).
