---
addr: 8E9DAE
size: 75
end: 8E9DF8
kind: code
category: 🎮
name: ring_menu_inventory_item_availability_filter
title: Build the four armour rings (body, helm, gloves, collar)
confidence: confirmed
tags: ["ring-menu"]
evidence: ["disasm v0.455.0: for armour i with a count in $231D+i, the ring item $C4:5ABE,2i goes to $0BFF (i 0-11), $0C23 (12-23), $0C47 (24-35), $0C6B (36-39); cursors on the equipped $0AC0/$0AC2/$0AC4/$0ABE"]
see: ["docs/open-evermore/resources.md"]
---
Fills `RING_ARMOUR_BODY`, `RING_ARMOUR_HELM`, `RING_ARMOUR_GLOVES` for the Boy (collars cleared) and `RING_ARMOUR_COLLAR` for the Dog (the others cleared), each through the armour → ring item table `$C4:5ABE`; the cursor on what is equipped.

Previously believed: "Filters and populates available usable items from player inventory into Item Ring Menu selection slots" (ring_menu_inventory_item_availability_filter).
