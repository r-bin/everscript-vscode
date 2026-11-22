---
addr: 8E9B6F
size: 82
end: 8E9BC0
kind: code
category: 🎮
name: ring_items_build
title: Build the items ring
confidence: confirmed
tags: ["ring-menu"]
evidence: ["disasm v0.455.0: Pouch ($9E) first when $8C:C3F8 or $8C:C41B say so, then $C4:5AAE,i for each consumable i with a count in $2315+i"]
see: ["docs/open-evermore/resources.md"]
---
Fills `RING_BOY_ITEMS`: the Pouch when there is anything in it, then each consumable held, through the consumable → ring item table `$C4:5AAE`.

Previously believed: "Rare and key item ring inventory list builder ($8E:9B6F)" (alchemy_menu_populate_rare_items).
