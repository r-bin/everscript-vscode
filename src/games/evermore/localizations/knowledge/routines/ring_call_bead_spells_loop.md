---
addr: 8EACEC
size: 87
end: 8EAD42
kind: code
category: 🎮
name: ring_call_bead_spells_loop
title: The Call Bead spells ring's loop
confidence: confirmed
tags: ["ring-menu"]
evidence: ["disasm v0.455.0: entry of RING_LOOPS for this ring; prints the item name from RING_ITEMS +0 ($8C:9E03), waits at $8E:ADBC"]
see: ["docs/open-evermore/resources.md"]
---
Runs the Call Bead spells ring while it is open: shows the selected item's name, and on confirm runs `CALL_BEAD_SPELL_ACTIONS` by the spell's index.

Previously believed: "Displays the confirmation prompt window for selling items or equipment in shops, showing the payout amount" (shopkeeper_dialogue_show_confirm_sell_box).
