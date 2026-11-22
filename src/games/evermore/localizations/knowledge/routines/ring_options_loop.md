---
addr: 8EA3EB
size: 89
end: 8EA443
kind: code
category: 🎮
name: ring_options_loop
title: The options (Boy and Dog) ring's loop
confidence: confirmed
tags: ["ring-menu", "reconstructed-c"]
evidence: ["disasm v0.455.0: entry of RING_LOOPS for this ring; prints the item name from RING_ITEMS +0 ($8C:9E03), waits at $8E:ADBC"]
see: ["docs/open-evermore/resources.md"]
---
Runs the options (Boy and Dog) ring while it is open: shows the selected item's name, and on confirm runs `RING_OPTION_ACTIONS` by the item's index. `$8E:A3EA` (an `rts`) is the debug ring's loop.

Previously believed: "Indirect sequence iteration and dispatch" (walk_indirect_sequence_with_dispatch).
