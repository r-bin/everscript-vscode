---
addr: 8E9A2F
size: 87
end: 8E9A85
kind: code
category: 🎮
name: ring_bazooka_ammo_build
title: Build the bazooka ammo ring
confidence: confirmed
tags: ["ring-menu"]
evidence: ["disasm v0.455.0: $0C93,x = #$42/#$44/#$46 for each ammo with a count in $2345/$2346/$2347; cursor from $2349"]
see: ["docs/open-evermore/resources.md"]
---
Fills `RING_BAZOOKA_AMMO`: Thunder Ball, Particle Bomb, Cryo-Blast for each ammo held; the cursor on the selected ammo (`$2349`/2).

Previously believed: "Scans learned formula bitfields and populates eligible spell entries into the Alchemy Ring Menu" (ring_menu_usable_alchemical_formula_filter).
