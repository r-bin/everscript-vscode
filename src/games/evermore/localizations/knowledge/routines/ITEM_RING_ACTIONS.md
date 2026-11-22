---
addr: 8EA873
size: 18
end: 8EA884
kind: table
category: 📋
name: ITEM_RING_ACTIONS
title: Consumable → what using it does
confidence: confirmed
tags: ["ring-menu","table"]
evidence: ["disasm v0.455.0: $8E:A867 jsr ($A873,x) in ring_items_loop, X = 2·the item's index"]
see: ["docs/open-evermore/resources.md"]
---
9 words: the seven consumables pick a target, Call Bead (7) opens the callers ring, Pouch (8) opens its screen. Open Evermore: `menus/item_actions/`.

Previously believed: "CDL pointer table ($8E:A873)" (ptrs_8EA873).
