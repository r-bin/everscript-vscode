---
addr: 8EA6CC
size: 169
end: 8EA774
kind: code
category: 🎮
name: ring_alchemy_loop
title: The alchemy ring's loop
confidence: confirmed
tags: ["ring-menu"]
evidence: ["disasm v0.455.0: entry of RING_LOOPS for this ring; prints the item name from RING_ITEMS +0 ($8C:9E03), waits at $8E:ADBC"]
see: ["docs/open-evermore/resources.md"]
---
Runs the alchemy ring while it is open: shows the selected item's name, the formula's level and casts left ($91:CE38), and on confirm runs `ALCHEMY_RING_ACTIONS` by the formula.

Previously believed: "Shop alchemy formula purchase prompt loop" (shop_alchemy_formula_purchase_prompt_loop).
