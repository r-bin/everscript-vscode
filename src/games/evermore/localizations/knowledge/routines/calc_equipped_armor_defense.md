---
addr: 8E99D2
size: 93
end: 8E9A2E
kind: code
category: 🧠
name: calc_equipped_armor_defense
title: Build the weapons ring
confidence: confirmed
tags: [ui, stats, armor, inventory]
evidence: ["disasm v0.455.0: for weapon x = $1A..2 whose flag word $C4:59A4,x has a bit of $C4:59C0,x, $07A8,y = the weapon record ($C4:3874,x) +$1E, or #$40 (Bazooka) for x = $1A"]
see: [routines/init_equipment_screen_slots.md, knowledge/wram/BOY_STATS.md, knowledge/wram/DOG_STATS.md]
---
Fills `RING_BOY_WEAPONS` with each weapon owned, its ring item from its weapon record (+$1E); the cursor on the equipped weapon (`$0ABA`). The name stays for the reconstructed C.

Previously believed: "Calculate equipped armor physical and magic defense sums".
