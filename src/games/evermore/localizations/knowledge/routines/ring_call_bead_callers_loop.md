---
addr: 8EA885
size: 87
end: 8EA8DB
kind: code
category: 🎮
name: ring_call_bead_callers_loop
title: The Call Bead callers ring's loop
confidence: confirmed
tags: ["ring-menu"]
evidence: ["disasm v0.455.0: entry of RING_LOOPS for this ring; prints the item name from RING_ITEMS +0 ($8C:9E03), waits at $8E:ADBC"]
see: ["docs/open-evermore/resources.md"]
---
Runs the Call Bead callers ring while it is open: shows the selected item's name, and on confirm runs `CALL_BEAD_CALLER_ACTIONS` (builds the caller's spells ring), then switches to the spells flow `$8E:99C2`.

Previously believed: "Displays the confirmation prompt window for purchasing items or equipment in shops, showing the price" (shopkeeper_dialogue_show_confirm_buy_box).
