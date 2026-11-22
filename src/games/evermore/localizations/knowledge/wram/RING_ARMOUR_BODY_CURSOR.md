---
addr: 7E0C01
size: 2
kind: var
name: RING_ARMOUR_BODY_CURSOR
title: Selected item of the body armour ring
type: u16
lifetime: room
confidence: confirmed
tags: ["ring-menu"]
evidence: ["disasm v0.455.0: RING_BUFFERS ($8E:9920) holds $0BFF; ring loops read +0 count, +2 cursor, +4 items through DP $95"]
see: ["docs/open-evermore/resources.md"]
---
The item the cursor rests on, 0 to count-1.

Previously believed: "Key Items ring menu selection, set to the item count when the list is built" (RING_MENU_KEY_ITEMS_SELECTION).
