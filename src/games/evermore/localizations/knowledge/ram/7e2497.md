---
addr: 7E2497
size: 2
kind: var
name: TARGET_WAYPOINT_X
title: Generic target waypoint X coordinate
lifetime: room
confidence: confirmed
tags: [movement, waypoint, coordinates]
evidence: ["scripts: Room 22 ($93:b9fd, $93:ba84, etc.) stages destination X into <0x2497> before invoking drop routines $93:bc03, $93:bb91, $93:bc6a; also copied from TRIGGER_INTERACTION_X at $93:bd12", "layout: precedes $7E:249D (PARTY_BOY_TARGET_X) in the 249x coordinate staging block"]
see: [ram/7e2499.md, ram/7e249d.md, ram/7e24a1.md]
---
Generic waypoint staging register holding target X coordinate in room pixels.

Used by room event scripts to set the horizontal destination for character navigation, forced walks, and pit drop routines (such as Bugmuck shaft falls in Room 22). Pairs with `TARGET_WAYPOINT_Y` (`ram/7e2499`). Scratch memory register (candidate for `<0x2834>`).
