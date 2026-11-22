---
addr: 7E0BFF
size: 2
kind: var
name: RING_ARMOUR_BODY_COUNT
title: Item count of the body armour ring
type: u16
lifetime: room
confidence: confirmed
tags: ["ring-menu"]
evidence: ["disasm v0.455.0: RING_BUFFERS ($8E:9920) holds $0BFF; ring loops read +0 count, +2 cursor, +4 items through DP $95"]
see: ["docs/open-evermore/resources.md"]
---
How many items the body armour ring holds (0: the flow skips the ring). Filled by `ring_menu_inventory_item_availability_filter`.

Previously believed: "Number of eligible key / story items in Key Items Ring Menu" (RING_MENU_KEY_ITEMS_COUNT).
