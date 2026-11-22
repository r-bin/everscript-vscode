---
addr: 8E8D05
size: 103
end: 8E8D6B
kind: code
category: 🎮
name: call_bead_callers
title: Call Bead: build the callers ring and switch to it
confidence: confirmed
tags: ["ring-menu"]
evidence: ["disasm v0.455.0: ITEM_RING_ACTIONS entry 7; fills $0CD9 with $F0 always, $F2 if $225C bit 7, $F4 if $225D bit 0, $F6 if $225D bit 1; sets $97 = $99B0"]
see: ["docs/open-evermore/resources.md"]
---
Using the Call Bead: fills `RING_CALL_BEAD_CALLERS` (Fire Eyes always; Horace, Camellia and Sidney by progress flags `$225C` bit 7, `$225D` bits 0 and 1) and switches to the callers flow.

Previously believed: "Configures shopkeeper dialogue option choices and clears joypad buffers before menu interaction" (shopkeeper_dialogue_choice_menu_item_setup).
