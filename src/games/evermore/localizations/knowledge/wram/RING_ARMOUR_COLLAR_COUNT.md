---
addr: 7E0C6B
size: 2
kind: var
name: RING_ARMOUR_COLLAR_COUNT
title: Item count of the Dog's collar ring
type: u16
lifetime: room
confidence: confirmed
tags: ["ring-menu"]
evidence: ["disasm v0.455.0: RING_BUFFERS ($8E:9920) holds $0C6B; ring loops read +0 count, +2 cursor, +4 items through DP $95"]
see: ["docs/open-evermore/resources.md"]
---
How many items the Dog's collar ring holds (0: the flow skips the ring). Filled by `ring_menu_inventory_item_availability_filter`.

Previously believed: "Number of eligible alchemy formulas in Formulas / Spells Ring Menu" (RING_MENU_SPELLS_COUNT).
