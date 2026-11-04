---
addr: 7E2499
size: 2
kind: var
name: TARGET_WAYPOINT_Y
title: Generic target waypoint Y coordinate
lifetime: room
confidence: confirmed
tags: [movement, waypoint, coordinates]
evidence: ["scripts: Room 22 ($93:b9fd, $93:ba84, etc.) stages destination Y into <0x2499> before invoking drop routines $93:bc03, $93:bb91, $93:bc6a; also copied from TRIGGER_INTERACTION_Y at $93:bd0c", "layout: precedes $7E:249F (PARTY_BOY_TARGET_Y) in the 249x coordinate staging block"]
see: [ram/7e2497.md, ram/7e249f.md, ram/7e24a3.md]
---
Generic waypoint staging register holding target Y coordinate in room pixels.

Used by room event scripts to set the vertical destination for character navigation, forced walks, and pit drop routines (such as Bugmuck shaft falls in Room 22). Pairs with `TARGET_WAYPOINT_X` (`ram/7e2497`). Scratch memory register (candidate for `<0x2834>`).
